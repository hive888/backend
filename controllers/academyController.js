const db = require('../config/database');
const logger = require('../utils/logger');

const Course = require('../models/courseModel');
const Customer = require('../models/Customer');
const AccessCode = require('../models/accessCodeModel');
const CustomerCourseAccess = require('../models/customerCourseAccessModel');

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


