// controllers/courseAccessController.js
const Customer = require('../models/Customer');
const AccessCode = require('../models/accessCodeModel');
const SelfStudyRegistration = require('../models/selfStudyRegistrationModel');
const Course = require('../models/courseModel');
const CustomerCourseAccess = require('../models/customerCourseAccessModel');
const { uploadToS3 } = require('../config/s3Config');
const Chapter = require('../models/chapterModel');
const Section = require('../models/sectionModel');
const Subsection = require('../models/subsectionModel');
const CustomerProgress = require('../models/customerProgressModel');
const { CoursePaymentService } = require('../config/coursePaymentService');
const PaymentTracking = require('../models/paymentTrackingModel');

// NOTE: This model writes to customer_section_quiz_status but we treat `section_id` as *subsection_id*
const SubsectionQuizStatus = require('../models/sectionQuizStatusModel');

// Quiz content (questions/options) are stored in subsection_quiz_* tables
const SubsectionQuiz = require('../models/subsectionQuizModel');

const db = require('../config/database');
const logger = require('../utils/logger');

// LOCK codes: 0=open, 1=locked by prerequisite, 2=locked by subscription
const LOCK = { OPEN: 0, PREREQ: 1, SUBONLY: 2 };

const SELF_STUDY_COURSE_SLUG = process.env.SELF_STUDY_COURSE_SLUG || 'self-study';

function normalizePhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '');
}
function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

async function getSelfStudyCourse() {
  try {
    return await Course.findBySlug(SELF_STUDY_COURSE_SLUG);
  } catch (_) {
    return null;
  }
}

function isActiveAndNotExpired(accessRow) {
  if (!accessRow) return false;
  if (accessRow.status !== 'active') return false;
  if (!accessRow.expires_at) return true;
  return new Date(accessRow.expires_at) > new Date();
}

/**
 * Backward-compat helper:
 * - Primary truth for legacy endpoints remains selfstudy_registrations (old structure)
 * - But if customer has active customer_course_access for SELF_STUDY_COURSE_SLUG, auto-create legacy registration.
 */
async function ensureSelfStudyRegistration(conn, customerId) {
  const customer_id = Number(customerId);
  if (!customer_id) return null;

  const existing = await SelfStudyRegistration.findByCustomer(conn, customer_id);
  if (existing && existing.status === 'active') return existing;

  const course = await getSelfStudyCourse();
  if (!course) return existing; // keep old behavior if not configured/seeded

  const [rows] = await conn.query(
    `SELECT status, expires_at, access_code_id
     FROM customer_course_access
     WHERE customer_id = ? AND course_id = ?
     LIMIT 1`,
    [customer_id, course.id]
  );
  const access = rows[0] || null;
  if (!isActiveAndNotExpired(access)) return existing;

  if (!existing) {
    await SelfStudyRegistration.create(conn, { customer_id, access_code_id: access.access_code_id ?? null });
  }
  return await SelfStudyRegistration.findByCustomer(conn, customer_id);
}

/** Section is complete if:
 *  - all its subsections completed, AND
 *  - any quiz_required subsection has PASSED status
 */
async function isSectionComplete(customerId, sectionId) {
  const { subsections } = await Subsection.getBySectionId(sectionId, {
    page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC'
  });
  if (subsections.length === 0) return false;

  const completedSet = new Set(await CustomerProgress.getCompletedSubsectionIds(customerId));
  if (!subsections.every(ss => completedSet.has(ss.id))) return false;

  for (const ss of subsections) {
    if (Number(ss.quiz_required) === 1) {
      // Treat SubsectionQuizStatus table as subsection-level quiz status store
      const q = await SubsectionQuizStatus.get(customerId, ss.id);
      if (q.status !== 'passed') return false;
    }
  }
  return true;
}

/**
 * POST /api/course-access/register
 * Body: { access_code: "PTGR2025" }
 * Auth: Bearer <JWT> (req.user.customer_id)
 */
exports.checkCourseAccessFromToken = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const { access_code } = req.body || {};

    if (!customerId) {
      return res.status(401).json({ 
        success: false, 
        code: 'UNAUTHORIZED', 
        message: 'Unauthorized: missing user in token.' 
      });
    }
    if (!access_code) {
      return res.status(400).json({ 
        success: false, 
        code: 'ACCESS_CODE_REQUIRED', 
        message: 'Please provide access_code in the request body.' 
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        code: 'CUSTOMER_NOT_FOUND', 
        message: 'Customer not found.' 
      });
    }

    // Access code validation
    const codeRow = await AccessCode.findActiveByCode(access_code);
    if (!codeRow) {
      return res.status(400).json({
        success: false, 
        code: 'ACCESS_CODE_INVALID',
        message: 'The provided access code is invalid, inactive, or expired.'
      });
    }

    await conn.beginTransaction();

    // Lock code row for safe update
    const lockedCode = await AccessCode.findByIdForUpdate(conn, codeRow.id);
    if (!lockedCode || lockedCode.is_active !== 1 || (lockedCode.expires_at && new Date(lockedCode.expires_at) < new Date())) {
      await conn.rollback();
      return res.status(400).json({
        success: false, 
        code: 'ACCESS_CODE_EXPIRED_OR_INACTIVE',
        message: 'The access code is not active or has expired.'
      });
    }

    // Optional (if self-study course exists): enforce that access code is for self-study
    const selfStudyCourse = await getSelfStudyCourse();
    if (selfStudyCourse && lockedCode.course_id && Number(lockedCode.course_id) !== Number(selfStudyCourse.id)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        code: 'ACCESS_CODE_WRONG_COURSE',
        message: 'This access code is not valid for the self-study course.'
      });
    }

    // Check if customer already registered
    const existingReg = await SelfStudyRegistration.findByCustomer(conn, customer.customer_id);
    if (existingReg) {
      // Keep new multi-course table in sync (best-effort)
      if (selfStudyCourse) {
        await CustomerCourseAccess.upsertActive(conn, {
          customer_id: customer.customer_id,
          course_id: selfStudyCourse.id,
          // DB enum is: ('access_code','purchase','admin'). This legacy flow is still access-code based.
          granted_via: 'access_code',
          access_code_id: existingReg.access_code_id || lockedCode.id
        });
      }
      await conn.commit();
      return res.status(200).json({
        success: true, 
        decision: 'ALREADY_REGISTERED', 
        code: 'ALREADY_REGISTERED',
        message: 'Customer already registered.',
        registration_id: existingReg.id, 
        customer_id: customer.customer_id,
        payment_status: 'already_registered'
      });
    }

    // Enforce max_uses
    if (lockedCode.max_uses !== null && lockedCode.max_uses !== undefined) {
      if (lockedCode.used_count >= lockedCode.max_uses) {
        await conn.rollback();
        return res.status(409).json({
          success: false, 
          code: 'ACCESS_CODE_EXHAUSTED',
          message: 'This access code has reached its maximum uses.'
        });
      }
    }

    // ========== PAYMENT CHECK ==========
    // Check if payment is required and completed
    const codeAmountRaw = lockedCode.payment_amount;
    const codeAmount = codeAmountRaw === null || codeAmountRaw === undefined ? 18.0 : Number(codeAmountRaw);
    const codeCurrency = lockedCode.payment_currency || 'USD';

    const existingPayment = await PaymentTracking.getByCustomerAndAccessCode(customer.customer_id, lockedCode.id);
    
    let paymentRequired = true;
    let paymentStatus = 'not_started';
    let paymentId = null;

    // Free code: no additional payment required
    if (!Number.isFinite(codeAmount) || codeAmount <= 0) {
      paymentRequired = false;
      paymentStatus = 'free';
    }
    
    if (existingPayment) {
      paymentStatus = existingPayment.payment_status;
      paymentId = existingPayment.id;
      
      // If payment is completed, proceed with registration
      if (existingPayment.payment_status === 'completed') {
        paymentRequired = false;
      }
    }
    
    // If payment is required but not completed, create payment record and return payment URL
    if (paymentRequired) {
      // Create or get payment record
      if (!existingPayment) {
        paymentId = await PaymentTracking.create(conn, {
          customer_id: customer.customer_id,
          access_code_id: lockedCode.id,
          amount: codeAmount,
          currency: codeCurrency,
          payment_method: 'stripe',
          payment_status: 'pending',
          payment_details: {
            description: `Course Access Payment for ${lockedCode.code}`,
            university: lockedCode.university_name,
            customer_email: customer.email,
            customer_name: `${customer.first_name} ${customer.last_name}`.trim()
          }
        });
        paymentStatus = 'pending';
      }
      
      await conn.commit();
      
      // Generate unique payment reference ID
      const paymentReference = `AC-${lockedCode.id}-${customer.customer_id}-${Date.now()}`;
      
      // Generate payment URLs
      const successUrl = `${process.env.FRONTEND_URL || 'https://your-frontend.com'}/course-payment/success`;
      const cancelUrl = `${process.env.FRONTEND_URL || 'https://your-frontend.com'}/course-payment/cancel`;
      
      try {
        // Create Stripe checkout session using NEW CoursePaymentService
        const paymentResult = await CoursePaymentService.createCourseAccessCheckoutSession(
          codeAmount, // Amount
          codeCurrency, // Currency
          paymentReference, // Payment reference
          {
            customer_id: customer.customer_id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email
          },
          {
            access_code_id: lockedCode.id,
            access_code: lockedCode.code,
            university_name: lockedCode.university_name
          },
          successUrl,
          cancelUrl
        );
        
        // Update payment record with Stripe session ID
        const updateConn = await db.getConnection();
        try {
          await PaymentTracking.updateStatus(
            updateConn,
            paymentId,
            'pending',
            paymentResult.sessionId, // Use as transaction_id
            null,
            {
              stripe_session_id: paymentResult.sessionId,
              payment_reference: paymentReference,
              checkout_url: paymentResult.url,
              stripe_checkout_url: paymentResult.url
            }
          );
        } finally {
          updateConn.release();
        }
        
        return res.status(200).json({
          success: true,
          decision: 'PAYMENT_REQUIRED',
          code: 'PAYMENT_REQUIRED',
          message: `Payment of ${codeAmount} ${codeCurrency} is required to complete registration.`,
          payment_required: true,
          payment_details: {
            payment_id: paymentId,
            payment_reference: paymentReference,
            status: paymentStatus,
            amount: codeAmount,
            currency: codeCurrency,
            access_code: lockedCode.code,
            university_name: lockedCode.university_name,
            checkout_url: paymentResult.url,
            stripe_session_id: paymentResult.sessionId,
            stripe_checkout_url: paymentResult.url
          },
          customer_info: {
            customer_id: customer.customer_id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email
          },
          instructions: 'Please complete the payment to activate your registration.'
        });
        
      } catch (paymentError) {
        logger.error('Course payment session creation failed:', paymentError);
        
        return res.status(500).json({
          success: false,
          code: 'PAYMENT_GATEWAY_ERROR',
          message: 'Failed to create payment session. Please try again.',
          details: paymentError.message
        });
      }
    }
    
    // ========== REGISTRATION PROCESS ==========
    // Only proceed if payment is completed
    
    // Create registration
    const registrationId = await SelfStudyRegistration.create(conn, {
      customer_id: customer.customer_id,
      access_code_id: lockedCode.id
    });

    // Keep new multi-course table in sync (best-effort)
    if (selfStudyCourse) {
      await CustomerCourseAccess.upsertActive(conn, {
        customer_id: customer.customer_id,
        course_id: selfStudyCourse.id,
        // DB enum is: ('access_code','purchase','admin'). This legacy flow is still access-code based.
        granted_via: 'access_code',
        access_code_id: lockedCode.id
      });
    }

    // Update payment record with registration ID
    if (paymentId) {
      await PaymentTracking.updateRegistrationId(conn, paymentId, registrationId);
    }

    // Increment access code usage
    await AccessCode.incrementUsage(conn, lockedCode.id);
    await conn.commit();

    const usedCountNext = lockedCode.used_count + 1;
    const remaining = lockedCode.max_uses == null ? null : Math.max(lockedCode.max_uses - usedCountNext, 0);

    return res.status(201).json({
      success: true,
      decision: 'REGISTERED',
      message: 'Customer registered to self-study program.',
      registration_id: registrationId,
      customer_id: customer.customer_id,
      payment_status: 'completed',
      code_stats: { 
        code: lockedCode.code, 
        used_count: usedCountNext, 
        remaining 
      },
      university_info: {
        name: lockedCode.university_name,
        total_students: lockedCode.total_students
      }
    });

  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    logger.error('checkCourseAccessFromToken error:', err);
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
 * GET /api/course-access/
 * NOT SUBSCRIBED: keep original 403 response
 * SUBSCRIBED: return subscription info + content + progress
 * Each subsection carries quiz_required and quiz_status.
 */
exports.getSubscriptionStatus = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(403).json({
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

    const reg = await ensureSelfStudyRegistration(conn, customer.customer_id);
    const subscribed = !!(reg && reg.status === 'active');

    if (!subscribed) {
      return res.status(403).json({
        success: true,
        decision: 'NOT_SUBSCRIBED',
        message: 'You are not subscribed.',
        subscribed: false,
        data: { customer_id: customer.customer_id }
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
        registration_id: reg.id,
        access_code_id: reg.access_code_id,
        status: reg.status,
        registered_at: reg.registered_at,
        customer_id: customer.customer_id,
        certificate_url:reg.certificate_url
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
    logger.error('getSubscriptionStatus error:', err);
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
 * GET /api/course-access/subsections/:id
 * Returns subsection content if subscribed AND prerequisites met.
 * Enforces prior quiz-required subsection passed.
 */
exports.getSubsectionContent = async (req, res) => {
  const conn = await db.getConnection();
  try {
    console.log('🔹 [START] getSubsectionContent called');
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);
    console.log('➡️  Params:', { customerId, subsectionId });

    if (!customerId) {
      console.log('❌ Missing user in token');
      return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    }
    if (!subsectionId) {
      console.log('❌ Invalid subsection id');
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid subsection id.' });
    }

    const customer = await Customer.findById(customerId);
    console.log('👤 Customer:', customer);
    if (!customer) {
      console.log('❌ Customer not found');
      return res.status(403).json({ success: false, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' });
    }

    const reg = await ensureSelfStudyRegistration(conn, customer.customer_id);
    console.log('🧾 Registration:', reg);
    if (!reg || reg.status !== 'active') {
      console.log('❌ Not subscribed or inactive registration');
      return res.status(403).json({ success: false, code: 'NOT_SUBSCRIBED', message: 'You are not subscribed.' });
    }

    const sub = await Subsection.getById(subsectionId);
    console.log('📚 Subsection:', sub);
    if (!sub) {
      console.log('❌ Subsection not found');
      return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    }

    const section = await Section.getById(sub.section_id);
    console.log('📖 Section:', section);
    if (!section) {
      console.log('❌ Section not found');
      return res.status(404).json({ success: false, code: 'SECTION_NOT_FOUND', message: 'Parent section not found.' });
    }

    const completedIds = await CustomerProgress.getCompletedSubsectionIds(customer.customer_id);
    const completedSet = new Set(completedIds);
    console.log('✅ Completed subsections:', [...completedSet]);

    // Check prior chapters
    const { chapters } = await Chapter.getAll({ page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    console.log('📚 Chapters fetched:', chapters.length);
    const chapterIndex = chapters.findIndex(c => Number(c.id) === Number(section.chapter_id));
    console.log('📖 Current chapter index:', chapterIndex);
    if (chapterIndex === -1) {
      console.log('❌ Chapter not found in structure');
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Chapter not found for this section.' });
    }

    for (let i = 0; i < chapterIndex; i++) {
      const ch = chapters[i];
      console.log(`🔸 Checking prerequisite chapter ${ch.id} (${ch.title})`);
      const { sections } = await Section.getByChapterId(ch.id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
      const allDone = await Promise.all(sections.map(s => isSectionComplete(customer.customer_id, s.id)));
      console.log('✅ Chapter sections completion:', allDone);
      if (!allDone.every(Boolean)) {
        console.log('❌ Previous chapter not fully complete');
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous chapters first.' });
      }
    }

    // Check prior sections
    const { sections } = await Section.getByChapterId(section.chapter_id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    console.log(`📄 Sections in current chapter (${section.chapter_id}):`, sections.length);
    const sectionIdx = sections.findIndex(s => Number(s.id) === Number(section.id));
    console.log('📘 Current section index:', sectionIdx);
    if (sectionIdx === -1) {
      console.log('❌ Section missing from its chapter');
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Section not in its chapter list.' });
    }

    for (let i = 0; i < sectionIdx; i++) {
      const ok = await isSectionComplete(customer.customer_id, sections[i].id);
      console.log(`🔸 Section ${sections[i].id} completion check:`, ok);
      if (!ok) {
        console.log('❌ Previous section incomplete');
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous sections first.' });
      }
    }

    // Check prior subsections
    const { subsections } = await Subsection.getBySectionId(section.id, { page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC' });
    console.log('📚 Subsections in this section:', subsections.length);
    const targetIdx = subsections.findIndex(ss => Number(ss.id) === Number(subsectionId));
    console.log('🎯 Target subsection index:', targetIdx);
    if (targetIdx === -1) {
      console.log('❌ Subsection not in its section list');
      return res.status(500).json({ success: false, code: 'COURSE_STRUCTURE_ERROR', message: 'Subsection not in its section list.' });
    }

    for (let i = 0; i < targetIdx; i++) {
      const prev = subsections[i];
      console.log(`🔹 Checking previous subsection ${prev.id} (${prev.title})`);
      if (!completedSet.has(prev.id)) {
        console.log('❌ Previous subsection not completed');
        return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Complete previous lessons first.' });
      }
      if (Number(prev.quiz_required) === 1) {
        const quizPrev = await SubsectionQuizStatus.get(customer.customer_id, prev.id);
        console.log('🧩 Quiz status for subsection', prev.id, quizPrev);
        if (!quizPrev || quizPrev.status !== 'passed') {
          console.log('❌ Quiz not passed for previous subsection');
          return res.status(403).json({ success: false, code: 'PREREQUISITE_LOCKED', message: 'Pass the previous quiz to continue.' });
        }
      }
    }

    const prevId = targetIdx > 0 ? subsections[targetIdx - 1].id : null;
    const nextId = await Subsection.getNextIdInSection(subsectionId);
    console.log('➡️ Navigation:', { prevId, nextId });

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

    console.log('✅ [SUCCESS] Returning subsection content:', result.data);
    return res.status(200).json(result);

  } catch (err) {
    console.error('💥 getSubsectionContent error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    console.log('🔚 [END] getSubsectionContent execution');
    conn.release();
  }
};



/**
 * POST /api/course-access/subsections/:id/complete
 * Marks a subsection as completed (idempotent).
 * Prereqs include prior quiz-required subsection passed.
 * Also blocks completing THIS subsection if it requires a quiz and it's not passed yet.
 */
exports.completeSubsection = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);

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

    const reg = await ensureSelfStudyRegistration(conn, customer.customer_id);
    if (!reg || reg.status !== 'active') {
      return res.status(403).json({ success: false, code: 'NOT_SUBSCRIBED', message: 'You are not subscribed.' });
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

    // Section prerequisites (complete)
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
    logger.error('completeSubsection error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/course-access/sections/:id/quiz
 * NOTE: We accept `:id` as a *subsection_id* (route name kept for backward-compat).
 * Returns: quiz_required, pass_score, status, attempts, score, last_attempt_at, and questions/options.
 */
exports.getSubsectionQuizInfo = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);

    if (!customerId) return res.status(403).json({ success:false, code:'UNAUTHORIZED', message:'Missing user in token.' });
    if (!subsectionId) return res.status(400).json({ success:false, code:'BAD_REQUEST', message:'Invalid subsection id.' });

    // must be subscribed
    const reg = await ensureSelfStudyRegistration(conn, customerId);
    if (!reg || reg.status !== 'active') {
      return res.status(403).json({ success:false, code:'NOT_SUBSCRIBED', message:'You are not subscribed.' });
    }

    const ss = await Subsection.getById(subsectionId);
    if (!ss) return res.status(404).json({ success:false, code:'SUBSECTION_NOT_FOUND', message:'Subsection not found.' });
    if (Number(ss.quiz_required) !== 1) {
      return res.status(400).json({ success:false, code:'QUIZ_NOT_REQUIRED', message:'Quiz is not required for this subsection.' });
    }

    // subsection-level status (via your existing table)
    const status = await SubsectionQuizStatus.get(customerId, subsectionId);

    // quiz content
    const questions = await SubsectionQuiz.getQuestions(subsectionId, conn);
    if (questions.length === 0) {
      return res.status(500).json({
        success:false,
        code:'QUIZ_NOT_CONFIGURED',
        message:'Quiz is required but not configured for this subsection.'
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
    logger.error('getSubsectionQuizInfo error:', err);
    return res.status(500).json({ success:false, code:'SERVER_ERROR', message:'Internal server error.' });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/course-access/sections/:id/quiz/submit
 * NOTE: `:id` is a subsection_id (route kept for backward-compat).
 * Body (preferred): { answers: [{question_id, option_id}, ...] }  OR  { answers: { [question_id]: option_id } }
 * Body (legacy):    { score: number }
 * Records a quiz attempt; if passed, auto-completes the subsection (idempotent).
 */

exports.submitSubsectionQuiz = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const customerId = req.user?.customer_id;
    const subsectionId = Number(req.params.id);
    const { answers, score } = req.body || {};

    // 👇 Track specific subsection
    if (subsectionId === 259) {
      // Fetch customer details to get full name
      const customer = await Customer.findById(customerId);
      const fullName = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Unknown Customer';
      
      logger.info('Quiz submission for subsection 259', {
        customerId,
        customerName: fullName,
        answers,
        score,
        timestamp: new Date().toISOString()
      });
    }

    if (!customerId) {
      return res.status(403).json({ success:false, code:'UNAUTHORIZED', message:'Missing user in token.' });
    }
    if (!subsectionId) {
      return res.status(400).json({ success:false, code:'BAD_REQUEST', message:'Invalid subsection id.' });
    }

    // ensure subscribed
    const reg = await ensureSelfStudyRegistration(conn, customerId);
    if (!reg || reg.status !== 'active') {
      return res.status(403).json({ success:false, code:'NOT_SUBSCRIBED', message:'You are not subscribed.' });
    }

    // fetch customer (so we can use customer.customer_id exactly as requested)
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success:false, code:'CUSTOMER_NOT_FOUND', message:'Customer not found.' });
    }

    // quiz metadata
    const ss = await Subsection.getById(subsectionId);
    if (!ss) return res.status(404).json({ success:false, code:'SUBSECTION_NOT_FOUND', message:'Subsection not found.' });
    if (Number(ss.quiz_required) !== 1) {
      return res.status(400).json({ success:false, code:'QUIZ_NOT_REQUIRED', message:'Quiz is not required for this subsection.' });
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
        return res.status(400).json({ success:false, code:'BAD_REQUEST', message:'Provide answers or numeric score.' });
      }
      finalScore = score;
    }

    const pass = finalScore >= required;

    // store quiz attempt result (table column section_id holds the SUBSECTION id)
    await SubsectionQuizStatus.recordResult(customer.customer_id, subsectionId, finalScore, pass);

    // If passed, mark content complete (idempotent) using exactly customer.customer_id
    if (pass) {
      await CustomerProgress.markSubsectionCompleted(customer.customer_id, subsectionId);
    }

    // next subsection in the same section
    if (subsectionId === 259) {
  next_subsection_id = null;
} else {
  next_subsection_id = await Subsection.getNextIdInSection(subsectionId);
}

    // --- NEW: return progress for this section ---
    // grab all subsections in the same section, then count completed
    const { subsections } = await Subsection.getBySectionId(ss.section_id, {
      page: 1, limit: 10000, sortBy: 'sort_order', order: 'ASC'
    });

    const completedIds = new Set(await CustomerProgress.getCompletedSubsectionIds(customer.customer_id));
    // ensure we reflect the just-passed completion even before any caching/lags
    if (pass) completedIds.add(subsectionId);

    const sectionCompleted = subsections.reduce((acc, s) => acc + (completedIds.has(s.id) ? 1 : 0), 0);
    const sectionTotal = subsections.length || 0;
    const sectionPercent = sectionTotal ? Math.round((sectionCompleted / sectionTotal) * 100) : 0;

    // 👇 GENERATE CERTIFICATE FOR SUBSECTION 259 IF PASSED
    let certificateUrl = null;
    if (subsectionId === 259 && pass) {
      try {
        const { certificate } = require('../services/saftOverlayService');
        
        // Prepare certificate data - adjust these fields based on your certificate template
        const investorName = String(`${customer.first_name || ''} ${customer.last_name || ''}`.trim());
        
        logger.info('Certificate generation for:', {
          customerId: customer.customer_id,
          investorName: investorName,
          firstName: customer.first_name,
          lastName: customer.last_name
        });

        // 👇 VALIDATE NAME
        if (!investorName || investorName === ' ') {
          throw new Error('Investor name is required for certificate');
        }

        // 👇 CALL WITH JUST FULL NAME (already a string)
        const buffer = await certificate(investorName);

        const fakeFile = {
          buffer,
          originalname: `Course_Certificate_${customer.customer_id}_${Date.now()}.pdf`,
          mimetype: 'application/pdf'
        };
        
        certificateUrl = await uploadToS3(fakeFile, 'certificates/');
        
        // 👇 UPDATE CERTIFICATE URL IN SELFSTUDY_REGISTRATIONS TABLE
        if (certificateUrl) {
          await SelfStudyRegistration.updateCertificateUrl(conn, customer.customer_id, certificateUrl);
          
          logger.info('Certificate URL updated in database for subsection 259', {
            customerId: customer.customer_id,
            certificateUrl,
            timestamp: new Date().toISOString()
          });
        }
        
        logger.info('Certificate generated for subsection 259', {
          customerId: customer.customer_id,
          customerName: investorName,
          certificateUrl,
          timestamp: new Date().toISOString()
        });
        
      } catch (certErr) {
        logger.error('Certificate generation failed for subsection 259:', {
          customerId: customer.customer_id,
          error: certErr.message,
          timestamp: new Date().toISOString()
        });
        // Don't fail the entire request if certificate generation fails
        certificateUrl = null;
      }
    }

    // Prepare response
    const response = {
      success: true,
      passed: pass,
      score: finalScore,
      required,
      next_subsection_id
    };

    // 👇 ADD CERTIFICATE URL TO RESPONSE IF AVAILABLE
    if (certificateUrl) {
      response.certificate_url = certificateUrl;
    }

    return res.status(200).json(response);

  } catch (err) {
    // 👇 ADD SPECIFIC SUBSECTION 259 ERROR LOGGING WITH CUSTOMER NAME
    const subsectionId = Number(req.params.id);
    if (subsectionId === 259) {
      const customerId = req.user?.customer_id;
      let customerName = 'Unknown Customer';
      
      try {
        // Try to fetch customer name for error logging
        const customer = await Customer.findById(customerId);
        if (customer) {
          customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        }
      } catch (nameErr) {
        // If we can't get the name, just log with what we have
        customerName = 'Name Unavailable';
      }
      
      logger.error('SPECIFIC ERROR - Quiz submission for subsection 259 failed:', {
        customerId: customerId,
        customerName: customerName,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.error('submitSubsectionQuiz error:', err);
    return res.status(500).json({ success:false, code:'SERVER_ERROR', message:'Internal server error.' });
  } finally {
    conn.release();
  }
};





exports.createSubsectionQuiz = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const subsectionId = Number(req.params.id);
    const { questions } = req.body || {};

    if (!subsectionId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Provide a valid subsection id and a non-empty "questions" array.'
      });
    }

    // ensure subsection exists
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

      // create question
      const questionId = await SubsectionQuiz.createQuestion(
        { subsection_id: subsectionId, prompt_html, sort_order },
        conn
      );

      // bulk options (if any)
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
    logger.error('createSubsectionQuiz error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};
exports.getSubsectionQuizAdminView = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const subsectionId = Number(req.params.id);
    if (!subsectionId) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Invalid subsection id.'
      });
    }

    // ensure subsection exists
    const ss = await Subsection.getById(subsectionId);
    if (!ss) {
      return res.status(404).json({
        success: false,
        code: 'SUBSECTION_NOT_FOUND',
        message: 'Subsection not found.'
      });
    }

    // get full quiz (admin view includes is_correct on options)
    const questions = await SubsectionQuiz.getQuestionsAdmin(subsectionId, conn);

    return res.status(200).json({
      success: true,
      data: {
        subsection_id: subsectionId,
        quiz_required: Number(ss.quiz_required) === 1,
        pass_score: ss.quiz_pass_score || 70,
        questions // [{question_id, prompt_html, sort_order, options:[{option_id,text_html,is_correct,sort_order}]}]
      }
    });
  } catch (err) {
    logger.error('getSubsectionQuizAdminView error:', err);
    return res.status(500).json({ success:false, code:'SERVER_ERROR', message:'Internal server error.' });
  } finally {
    conn.release();
  }
};