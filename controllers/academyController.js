const db = require('../config/database');
const logger = require('../utils/logger');

const Course = require('../models/courseModel');
const Customer = require('../models/Customer');
const AccessCode = require('../models/accessCodeModel');
const CustomerCourseAccess = require('../models/customerCourseAccessModel');
const Chapter = require('../models/chapterModel');
const Section = require('../models/sectionModel');
const Subsection = require('../models/subsectionModel');
const CustomerProgress = require('../models/customerProgressModel');
const SubsectionQuizStatus = require('../models/sectionQuizStatusModel');
const SubsectionQuiz = require('../models/subsectionQuizModel');

// LOCK codes: 0=open, 1=locked by prerequisite, 2=locked by subscription
const LOCK = { OPEN: 0, PREREQ: 1, SUBONLY: 2 };

function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

async function isSectionComplete(customerId, sectionId) {
  const { subsections } = await Subsection.getBySectionId(sectionId, {
    page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC'
  });
  if (subsections.length === 0) return false;

  const completedSet = new Set(await CustomerProgress.getCompletedSubsectionIds(customerId));
  if (!subsections.every(ss => completedSet.has(ss.id))) return false;

  for (const ss of subsections) {
    if (Number(ss.quiz_required) === 1) {
      const q = await SubsectionQuizStatus.get(customerId, ss.id);
      if (q.status !== 'passed') return false;
    }
  }
  return true;
}

function sanitizeCourse(course) {
  if (!course) return course;
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    short_description: course.short_description,
    detailed_description: course.detailed_description,
    thumbnail_url: course.thumbnail_url,
    is_active: course.is_active
  };
}

exports.listCourses = async (_req, res) => {
  try {
    const courses = await Course.listActive();
    return res.json({
      success: true,
      message: 'Courses retrieved successfully',
      data: courses.map(sanitizeCourse)
    });
  } catch (err) {
    logger.error('Academy.listCourses error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load courses', code: 'SERVER_ERROR' });
  }
};

// Authenticated: list the course catalog with a flag for whether the current customer is registered/has access
exports.listMyCourses = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const courses = await Course.listActive();
    const accessRows = await CustomerCourseAccess.listByCustomer(customerId);
    const byCourseId = new Map(accessRows.map(r => [Number(r.course_id), r]));

    const now = new Date();
    const enriched = courses.map((c) => {
      const access = byCourseId.get(Number(c.id));
      const isRegistered = !!(
        access &&
        access.status === 'active' &&
        (!access.expires_at || new Date(access.expires_at) > now)
      );
      return { ...sanitizeCourse(c), is_registered: isRegistered };
    });

    return res.json({
      success: true,
      message: 'Courses retrieved successfully',
      data: enriched
    });
  } catch (err) {
    logger.error('Academy.listMyCourses error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load courses', code: 'SERVER_ERROR' });
  }
};

// Developer-only: create a course in the catalog
exports.createCourse = async (req, res) => {
  try {
    const { slug, title, short_description, detailed_description, thumbnail_url, is_active } = req.body || {};

    const created = await Course.create({
      slug,
      title,
      short_description: short_description ?? null,
      detailed_description: detailed_description ?? null,
      thumbnail_url: thumbnail_url ?? null,
      is_active: is_active === undefined ? 1 : (is_active ? 1 : 0)
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: sanitizeCourse(created)
    });
  } catch (err) {
    // Duplicate slug
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'A course with this slug already exists',
        code: 'DUPLICATE_ENTRY',
        field: 'slug'
      });
    }
    logger.error('Academy.createCourse error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create course', code: 'SERVER_ERROR' });
  }
};

exports.getCourseBySlug = async (req, res) => {
  try {
    const course = await Course.findBySlug(req.params.slug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' });
    }
    return res.json({ success: true, message: 'Course retrieved successfully', data: sanitizeCourse(course) });
  } catch (err) {
    logger.error('Academy.getCourseBySlug error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load course', code: 'SERVER_ERROR' });
  }
};

exports.getMyCourseAccess = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const course = await Course.findBySlug(req.params.slug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' });
    }

    const access = await CustomerCourseAccess.findByCustomerAndCourse(customerId, course.id);
    const hasAccess = !!(access && access.status === 'active' && (!access.expires_at || new Date(access.expires_at) > new Date()));

    return res.json({
      success: true,
      message: 'Course access checked',
      data: {
        course: sanitizeCourse(course),
        has_access: hasAccess,
        status: access?.status || 'none',
        expires_at: access?.expires_at || null
      }
    });
  } catch (err) {
    logger.error('Academy.getMyCourseAccess error:', err);
    return res.status(500).json({ success: false, error: 'Failed to check access', code: 'SERVER_ERROR' });
  }
};

/**
 * POST /api/academy/courses/:slug/redeem
 * Body: { access_code }
 * Grants access to that specific course by access code.
 */
exports.redeemAccessCode = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const { access_code } = req.body || {};

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    if (!access_code) {
      return res.status(400).json({ success: false, error: 'access_code is required', code: 'ACCESS_CODE_REQUIRED' });
    }

    const course = await Course.findBySlug(req.params.slug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const codeRow = await AccessCode.findActiveByCode(access_code);
    if (!codeRow) {
      return res.status(400).json({ success: false, error: 'Invalid or expired access code', code: 'ACCESS_CODE_INVALID' });
    }

    // Ensure code belongs to this course
    if (!codeRow.course_id || Number(codeRow.course_id) !== Number(course.id)) {
      return res.status(400).json({ success: false, error: 'Access code is not valid for this course', code: 'ACCESS_CODE_WRONG_COURSE' });
    }

    await conn.beginTransaction();

    const lockedCode = await AccessCode.findByIdForUpdate(conn, codeRow.id);
    if (!lockedCode || lockedCode.is_active !== 1 || (lockedCode.expires_at && new Date(lockedCode.expires_at) < new Date())) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Access code is inactive or expired', code: 'ACCESS_CODE_EXPIRED_OR_INACTIVE' });
    }

    // Max uses check
    if (lockedCode.max_uses != null && lockedCode.used_count >= lockedCode.max_uses) {
      await conn.rollback();
      return res.status(409).json({ success: false, error: 'Access code has reached max uses', code: 'ACCESS_CODE_EXHAUSTED' });
    }

    // Prevent reuse by same customer (uses existing table if present)
    const alreadyUsed = await AccessCode.hasUsageByCustomer(conn, lockedCode.id, customer.customer_id);
    if (alreadyUsed) {
      await conn.commit();
      return res.status(200).json({
        success: true,
        message: 'Access code already used by this customer',
        data: { course: sanitizeCourse(course), has_access: true }
      });
    }

    await AccessCode.incrementUsage(conn, lockedCode.id);
    await AccessCode.recordUsage(conn, lockedCode.id, customer.customer_id);
    await CustomerCourseAccess.upsertActive(conn, {
      customer_id: customer.customer_id,
      course_id: course.id,
      granted_via: 'access_code',
      access_code_id: lockedCode.id
    });

    await conn.commit();

    const remaining = lockedCode.max_uses == null ? null : Math.max(lockedCode.max_uses - (lockedCode.used_count + 1), 0);
    return res.status(201).json({
      success: true,
      message: 'Course access granted',
      data: {
        course: sanitizeCourse(course),
        has_access: true,
        code_stats: { code: lockedCode.code, remaining }
      }
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    logger.error('Academy.redeemAccessCode error:', err);
    return res.status(500).json({ success: false, error: 'Failed to redeem access code', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/academy/courses/:slug/content
 * Returns full course content structure (chapters, sections, subsections) with progress
 * Similar to legacy /api/course-access endpoint but uses multi-course access system
 */
exports.getCourseContent = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized: missing user in token.'
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(403).json({
        success: false,
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found.'
      });
    }

    const course = await Course.findBySlug(req.params.slug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found.'
      });
    }

    // Check access using new multi-course system
    const access = await CustomerCourseAccess.findByCustomerAndCourse(customerId, course.id);
    const hasAccess = !!(access && access.status === 'active' && (!access.expires_at || new Date(access.expires_at) > new Date()));

    if (!hasAccess) {
      return res.status(403).json({
        success: true,
        decision: 'NOT_SUBSCRIBED',
        message: 'You are not subscribed to this course.',
        subscribed: false,
        data: {
          customer_id: customer.customer_id,
          course: sanitizeCourse(course)
        }
      });
    }

    const completedSet = new Set(await CustomerProgress.getCompletedSubsectionIds(customer.customer_id));
    const { chapters } = await Chapter.getAll({ page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });

    const contentData = [];
    let totalChapters = chapters.length;
    let courseTotalSubs = 0;
    let courseCompletedSubs = 0;

    // Chapter 1 starts open; next chapters unlock when previous fully complete
    let prevChapterComplete = true;

    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      const ch = chapters[chIdx];
      const chapterLocked = prevChapterComplete ? LOCK.OPEN : LOCK.PREREQ;

      const { sections } = await Section.getByChapterId(ch.id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });

      const chapterNode = {
        id: String(ch.id),
        title: ch.title,
        description: null,
        locked: chapterLocked,
        sections: [],
        chapterDuration: 0,
        meta: {
          totalSections: sections.length,
          totalSubsections: 0,
          completedSubsections: 0,
          progress: 0,
          duration: 0
        }
      };

      // a section is unlocked if previous section is fully complete (including quiz-required subsections)
      let prevSectionComplete = (chapterLocked === LOCK.OPEN);

      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const s = sections[sIdx];
        const sectionLocked = prevSectionComplete ? LOCK.OPEN : LOCK.PREREQ;

        const { subsections } = await Subsection.getBySectionId(s.id, {
          page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC'
        });

        let sectionTotal = subsections.length;
        let sectionCompleted = 0;

        // within a section: each subsection unlocks if the previous is completed
        // AND if the previous had quiz_required = 1, its quiz must be passed.
        let prevSubChainOpen = (sectionLocked === LOCK.OPEN);

        const subsectionNodes = [];
        for (let idx = 0; idx < subsections.length; idx++) {
          const ss = subsections[idx];
          const isCompleted = completedSet.has(ss.id);
          if (isCompleted) sectionCompleted += 1;

          // quiz gate from previous subsection (if any)
          if (idx > 0 && prevSubChainOpen) {
            const prev = subsections[idx - 1];
            if (Number(prev.quiz_required) === 1) {
              const quizPrev = await SubsectionQuizStatus.get(customer.customer_id, prev.id);
              if (quizPrev.status !== 'passed') {
                prevSubChainOpen = false; // gate closed until previous quiz passed
              }
            }
          }

          const lockState = prevSubChainOpen ? LOCK.OPEN : LOCK.PREREQ;

          // this subsection quiz info
          const quizInfo = Number(ss.quiz_required) === 1
            ? await SubsectionQuizStatus.get(customer.customer_id, ss.id)
            : { status: 'not_started' };

          subsectionNodes.push({
            id: String(ss.id),
            title: ss.title,
            description: null,
            duration: 0,
            completed: isCompleted,
            locked: lockState,
            sequence: idx + 1,
            chapter: Number(ch.id),
            quiz_required: Number(ss.quiz_required) === 1,
            quiz_status: quizInfo.status
          });

          // advance chain only if this one is completed
          if (!isCompleted) prevSubChainOpen = false;
        }

        const sectionNode = {
          id: `${ch.id}-${s.id}`,
          title: s.title,
          description: s.subtitle || null,
          locked: sectionLocked,
          subsections: subsectionNodes,
          meta: {
            totalSubsections: sectionTotal,
            completedSubsections: sectionCompleted,
            progress: pct(sectionCompleted, sectionTotal),
            duration: 0
          }
        };

        // next section unlocks only when THIS one is fully complete
        const sectionIsFullyComplete = await isSectionComplete(customer.customer_id, s.id);
        prevSectionComplete = sectionIsFullyComplete;

        chapterNode.sections.push(sectionNode);
        chapterNode.meta.totalSubsections += sectionTotal;
        chapterNode.meta.completedSubsections += sectionCompleted;
      }

      chapterNode.meta.progress = pct(chapterNode.meta.completedSubsections, chapterNode.meta.totalSubsections);
      prevChapterComplete =
        (chapterNode.meta.completedSubsections === chapterNode.meta.totalSubsections && chapterNode.meta.totalSubsections > 0);

      contentData.push(chapterNode);
      courseTotalSubs += chapterNode.meta.totalSubsections;
      courseCompletedSubs += chapterNode.meta.completedSubsections;
    }

    return res.status(200).json({
      success: true,
      decision: 'SUBSCRIBED',
      message: 'You are subscribed.',
      subscribed: true,
      data: {
        course: sanitizeCourse(course),
        customer_id: customer.customer_id,
        status: access.status,
        expires_at: access.expires_at,
        access_code_id: access.access_code_id
      },
      content: {
        data: contentData,
        meta: {
          totalChapters,
          progress: pct(courseCompletedSubs, courseTotalSubs)
        }
      }
    });

  } catch (err) {
    logger.error('Academy.getCourseContent error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error.'
    });
  } finally {
    conn.release();
  }
};

/**
 * Helper function to check course access using multi-course system
 */
async function checkCourseAccess(conn, customerId, courseId) {
  const access = await CustomerCourseAccess.findByCustomerAndCourse(customerId, courseId);
  const hasAccess = !!(access && access.status === 'active' && (!access.expires_at || new Date(access.expires_at) > new Date()));
  return { access, hasAccess };
}

/**
 * GET /api/academy/courses/:slug/subsections/:id
 * Returns subsection content if subscribed AND prerequisites met.
 * Multi-course version - works for any course by slug
 */
exports.getSubsectionContent = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);
    const courseSlug = req.params.slug;

    if (!customerId) {
      return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    }
    if (!subsectionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid subsection id.' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(403).json({ success: false, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' });
    }

    const course = await Course.findBySlug(courseSlug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    }

    const { hasAccess } = await checkCourseAccess(conn, customer.customer_id, course.id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, code: 'NOT_SUBSCRIBED', message: 'You are not subscribed to this course.' });
    }

    const sub = await Subsection.getById(subsectionId);
    if (!sub) {
      return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    }

    const section = await Section.getById(sub.section_id);
    if (!section) {
      return res.status(404).json({ success: false, code: 'SECTION_NOT_FOUND', message: 'Parent section not found.' });
    }

    const completedIds = await CustomerProgress.getCompletedSubsectionIds(customer.customer_id);
    const completedSet = new Set(completedIds);

    // Check prior chapters
    const { chapters } = await Chapter.getAll({ page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    const chapterIndex = chapters.findIndex(c => Number(c.id) === Number(section.chapter_id));
    if (chapterIndex === -1) {
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Chapter not found for this section.' });
    }

    for (let i = 0; i < chapterIndex; i++) {
      const ch = chapters[i];
      const { sections } = await Section.getByChapterId(ch.id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
      const allDone = await Promise.all(sections.map(s => isSectionComplete(customer.customer_id, s.id)));
      if (!allDone.every(Boolean)) {
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous chapters first.' });
      }
    }

    // Check prior sections
    const { sections } = await Section.getByChapterId(section.chapter_id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    const sectionIdx = sections.findIndex(s => Number(s.id) === Number(section.id));
    if (sectionIdx === -1) {
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Section not in its chapter list.' });
    }

    for (let i = 0; i < sectionIdx; i++) {
      const ok = await isSectionComplete(customer.customer_id, sections[i].id);
      if (!ok) {
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous sections first.' });
      }
    }

    // Check prior subsections
    const { subsections } = await Subsection.getBySectionId(section.id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    const targetIdx = subsections.findIndex(ss => Number(ss.id) === Number(subsectionId));
    if (targetIdx === -1) {
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Subsection not in its section list.' });
    }

    for (let i = 0; i < targetIdx; i++) {
      const prev = subsections[i];
      if (!completedSet.has(prev.id)) {
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous lessons first.' });
      }
      if (Number(prev.quiz_required) === 1) {
        const quizPrev = await SubsectionQuizStatus.get(customer.customer_id, prev.id);
        if (!quizPrev || quizPrev.status !== 'passed') {
          return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Pass the previous quiz to continue.' });
        }
      }
    }

    const prevId = targetIdx > 0 ? subsections[targetIdx - 1].id : null;
    const nextId = await Subsection.getNextIdInSection(subsectionId);

    const result = {
      success: true,
      data: {
        id: sub.id,
        title: sub.title,
        content_html: sub.content_html,
        section_id: section.id,
        quiz_required: sub.quiz_required,
        chapter_id: section.chapter_id,
        locked: LOCK.OPEN,
        completed: completedSet.has(sub.id),
        navigation: {
          previous_subsection_id: prevId,
          next_subsection_id: nextId
        }
      }
    };

    return res.status(200).json(result);

  } catch (err) {
    logger.error('Academy.getSubsectionContent error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/academy/courses/:slug/subsections/:id/complete
 * Marks a subsection as completed (idempotent).
 * Multi-course version - works for any course by slug
 */
exports.completeSubsection = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);
    const courseSlug = req.params.slug;

    if (!customerId) {
      return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    }
    if (!subsectionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid subsection id.' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(403).json({ success: false, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' });
    }

    const course = await Course.findBySlug(courseSlug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    }

    const { hasAccess } = await checkCourseAccess(conn, customer.customer_id, course.id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, code: 'NOT_SUBSCRIBED', message: 'You are not subscribed to this course.' });
    }

    const sub = await Subsection.getById(subsectionId);
    if (!sub) {
      return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    }
    const section = await Section.getById(sub.section_id);
    if (!section) {
      return res.status(404).json({ success: false, code: 'SECTION_NOT_FOUND', message: 'Parent section not found.' });
    }

    const completedSet = new Set(await CustomerProgress.getCompletedSubsectionIds(customer.customer_id));

    // Chapter prerequisites
    const { chapters } = await Chapter.getAll({ page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    const chapterIndex = chapters.findIndex(c => Number(c.id) === Number(section.chapter_id));
    if (chapterIndex === -1) {
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Chapter not found for this section.' });
    }
    for (let i = 0; i < chapterIndex; i++) {
      const ch = chapters[i];
      const { sections } = await Section.getByChapterId(ch.id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
      const allDone = await Promise.all(sections.map(s => isSectionComplete(customer.customer_id, s.id)));
      if (!allDone.every(Boolean)) {
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous chapters first.' });
      }
    }

    // Section prerequisites
    const { sections } = await Section.getByChapterId(section.chapter_id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    const sectionIdx = sections.findIndex(s => Number(s.id) === Number(section.id));
    if (sectionIdx === -1) {
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Section not in its chapter list.' });
    }
    for (let i = 0; i < sectionIdx; i++) {
      const ok = await isSectionComplete(customer.customer_id, sections[i].id);
      if (!ok) {
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous sections first.' });
      }
    }

    // Prior subsections completed + prior quiz passed if required
    const { subsections } = await Subsection.getBySectionId(section.id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    const targetIdx = subsections.findIndex(ss => Number(ss.id) === Number(subsectionId));
    if (targetIdx === -1) {
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Subsection not in its section list.' });
    }
    for (let i = 0; i < targetIdx; i++) {
      const prev = subsections[i];
      if (!completedSet.has(prev.id)) {
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous lessons first.' });
      }
      if (Number(prev.quiz_required) === 1) {
        const quizPrev = await SubsectionQuizStatus.get(customer.customer_id, prev.id);
        if (quizPrev.status !== 'passed') {
          return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Pass the previous quiz to continue.' });
        }
      }
    }

    // THIS subsection requires a quiz? block completion until quiz passed
    if (Number(sub.quiz_required) === 1) {
      const thisQuiz = await SubsectionQuizStatus.get(customer.customer_id, sub.id);
      if (thisQuiz.status !== 'passed') {
        return res.status(403).json({
          success: false,
          code: 'QUIZ_REQUIRED_NOT_PASSED',
          message: 'This lesson requires passing its quiz before it can be marked completed.'
        });
      }
    }

    await CustomerProgress.markSubsectionCompleted(customer.customer_id, subsectionId);
    
    // Get next subsection ID
    const next_subsection_id = subsectionId === 259 ? null : await Subsection.getNextIdInSection(subsectionId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Subsection marked as completed.',
      next_subsection_id
    });

  } catch (err) {
    logger.error('Academy.completeSubsection error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/academy/courses/:slug/sections/:id/quiz
 * NOTE: `:id` is a subsection_id (route name kept for backward-compat).
 * Returns: quiz_required, pass_score, status, attempts, score, last_attempt_at, and questions/options.
 * Multi-course version - works for any course by slug
 */
exports.getSubsectionQuizInfo = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);
    const courseSlug = req.params.slug;

    if (!customerId) return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    if (!subsectionId) return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid subsection id.' });

    const course = await Course.findBySlug(courseSlug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    }

    const { hasAccess } = await checkCourseAccess(conn, customerId, course.id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, code: 'NOT_SUBSCRIBED', message: 'You are not subscribed to this course.' });
    }

    const ss = await Subsection.getById(subsectionId);
    if (!ss) return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    if (Number(ss.quiz_required) !== 1) {
      return res.status(400).json({ success: false, code: 'QUIZ_NOT_REQUIRED', message: 'Quiz is not required for this subsection.' });
    }

    const status = await SubsectionQuizStatus.get(customerId, subsectionId);
    const questions = await SubsectionQuiz.getQuestions(subsectionId, conn);
    if (questions.length === 0) {
      return res.status(500).json({
        success: false,
        code: 'QUIZ_NOT_CONFIGURED',
        message: 'Quiz is required but not configured for this subsection.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        subsection_id: subsectionId,
        quiz_required: true,
        pass_score: ss.quiz_pass_score || 70,
        status: status.status || 'not_started',
        attempts: status.attempts || 0,
        score: status.score || 0,
        last_attempt_at: status.last_attempt_at || null,
        questions
      }
    });
  } catch (err) {
    logger.error('Academy.getSubsectionQuizInfo error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/academy/courses/:slug/sections/:id/quiz/submit
 * NOTE: `:id` is a subsection_id (route kept for backward-compat).
 * Body (preferred): { answers: [{question_id, option_id}, ...] }  OR  { answers: { [question_id]: option_id } }
 * Body (legacy):    { score: number }
 * Records a quiz attempt; if passed, auto-completes the subsection (idempotent).
 * Multi-course version - works for any course by slug
 */
exports.submitSubsectionQuiz = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);
    const courseSlug = req.params.slug;
    const { answers, score } = req.body || {};

    if (!customerId) {
      return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    }
    if (!subsectionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid subsection id.' });
    }

    const course = await Course.findBySlug(courseSlug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    }

    const { hasAccess } = await checkCourseAccess(conn, customerId, course.id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, code: 'NOT_SUBSCRIBED', message: 'You are not subscribed to this course.' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' });
    }

    const ss = await Subsection.getById(subsectionId);
    if (!ss) return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    if (Number(ss.quiz_required) !== 1) {
      return res.status(400).json({ success: false, code: 'QUIZ_NOT_REQUIRED', message: 'Quiz is not required for this subsection.' });
    }

    const required = ss.quiz_pass_score || 0;

    // Preferred: grade server-side from answers
    let finalScore;
    if (answers !== undefined) {
      const { score: computed } = await SubsectionQuiz.gradeAnswers(subsectionId, answers, conn);
      finalScore = computed;
    } else {
      // Legacy fallback for existing clients
      if (typeof score !== 'number') {
        return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Provide answers or numeric score.' });
      }
      finalScore = score;
    }

    const pass = finalScore >= required;
    await SubsectionQuizStatus.recordResult(customer.customer_id, subsectionId, finalScore, pass);

    // If passed, mark content complete (idempotent)
    if (pass) {
      await CustomerProgress.markSubsectionCompleted(customer.customer_id, subsectionId);
    }

    // next subsection in the same section
    const next_subsection_id = subsectionId === 259 ? null : await Subsection.getNextIdInSection(subsectionId);

    // Return progress for this section
    const { subsections } = await Subsection.getBySectionId(ss.section_id, {
      page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC'
    });

    const completedIds = new Set(await CustomerProgress.getCompletedSubsectionIds(customer.customer_id));
    if (pass) completedIds.add(subsectionId);

    const sectionCompleted = subsections.reduce((acc, s) => acc + (completedIds.has(s.id) ? 1 : 0), 0);
    const sectionTotal = subsections.length || 0;
    const sectionPercent = sectionTotal ? Math.round((sectionCompleted / sectionTotal) * 100) : 0;

    return res.status(200).json({
      success: true,
      passed: pass,
      score: finalScore,
      required,
      next_subsection_id,
      section_progress: {
        completed: sectionCompleted,
        total: sectionTotal,
        percentage: sectionPercent
      }
    });

  } catch (err) {
    logger.error('Academy.submitSubsectionQuiz error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/academy/courses/:slug/sections/:id/quiz
 * Creates quiz questions for a subsection (admin only).
 * NOTE: `:id` is a subsection_id
 * Multi-course version - works for any course by slug
 */
exports.createSubsectionQuiz = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const subsectionId = Number(req.params.id);
    const courseSlug = req.params.slug;
    const { questions } = req.body || {};

    if (!subsectionId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Provide a valid subsection id and a non-empty "questions" array.'
      });
    }

    const course = await Course.findBySlug(courseSlug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    }

    const ss = await Subsection.getById(subsectionId);
    if (!ss) {
      return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    }

    await conn.beginTransaction();

    const created = [];
    for (const q of questions) {
      const prompt_html = q?.prompt_html;
      const sort_order = q?.sort_order ?? 0;
      const options = Array.isArray(q?.options) ? q.options : [];

      if (!prompt_html) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Each question needs "prompt_html".'
        });
      }

      const questionId = await SubsectionQuiz.createQuestion(
        { subsection_id: subsectionId, prompt_html, sort_order },
        conn
      );

      let optionIds = [];
      if (options.length > 0) {
        const cleaned = options.map(o => ({
          text_html: o?.text_html ?? '',
          is_correct: o?.is_correct ? 1 : 0,
          sort_order: o?.sort_order ?? 0
        }));
        const bulk = await SubsectionQuiz.createOptionsBulk(questionId, cleaned, conn);
        optionIds = bulk.ids || [];
      }

      created.push({ question_id: questionId, option_ids: optionIds });
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: `Created ${created.length} question(s) with options.`,
      data: {
        subsection_id: subsectionId,
        created
      }
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    logger.error('Academy.createSubsectionQuiz error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/academy/courses/:slug/sections/:id/quiz/admin
 * Admin view of quiz (includes is_correct on options).
 * NOTE: `:id` is a subsection_id
 * Multi-course version - works for any course by slug
 */
exports.getSubsectionQuizAdminView = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const subsectionId = Number(req.params.id);
    const courseSlug = req.params.slug;

    if (!subsectionId) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Invalid subsection id.'
      });
    }

    const course = await Course.findBySlug(courseSlug);
    if (!course || course.is_active !== 1) {
      return res.status(404).json({ success: false, code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    }

    const ss = await Subsection.getById(subsectionId);
    if (!ss) {
      return res.status(404).json({
        success: false,
        code: 'SUBSECTION_NOT_FOUND',
        message: 'Subsection not found.'
      });
    }

    const questions = await SubsectionQuiz.getQuestionsAdmin(subsectionId, conn);

    return res.status(200).json({
      success: true,
      data: {
        subsection_id: subsectionId,
        quiz_required: Number(ss.quiz_required) === 1,
        pass_score: ss.quiz_pass_score || 70,
        questions
      }
    });
  } catch (err) {
    logger.error('Academy.getSubsectionQuizAdminView error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};


