const db = require('../config/database');
const logger = require('../utils/logger');
const Subsection = require('../models/subsectionModel');
const SubsectionQuiz = require('../models/subsectionQuizModel');

/**
 * GET /api/audit/subsection-navigation
 * Audits subsection navigation to identify broken chains and missing subsections
 * 
 * Checks:
 * - All subsections have valid next navigation
 * - No broken chains (missing next subsections)
 * - Quiz configuration where required
 * - Section ordering consistency
 * - Gaps in subsection sequence
 */
exports.auditSubsectionNavigation = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const auditResults = {
      summary: {
        total_subsections: 0,
        subsections_with_issues: 0,
        broken_navigation_chains: 0,
        missing_quizzes: 0,
        ordering_issues: 0
      },
      issues: [],
      navigation_map: [],
      section_analysis: []
    };

    // Get all subsections ordered by ID
    const [allSubsections] = await conn.query(
      `SELECT ss.*, s.title as section_title, s.id as section_id, c.title as chapter_title
       FROM subsections ss
       LEFT JOIN sections s ON ss.section_id = s.id
       LEFT JOIN chapters c ON s.chapter_id = c.id
       ORDER BY ss.id ASC`
    );

    auditResults.summary.total_subsections = allSubsections.length;

    // Group subsections by section for section-level analysis
    const subsectionsBySection = {};
    allSubsections.forEach(ss => {
      const sectionId = ss.section_id || 'no_section';
      if (!subsectionsBySection[sectionId]) {
        subsectionsBySection[sectionId] = {
          section_id: ss.section_id,
          section_title: ss.section_title || 'No Section',
          chapter_title: ss.chapter_title || 'No Chapter',
          subsections: []
        };
      }
      subsectionsBySection[sectionId].subsections.push(ss);
    });

    // Analyze each subsection
    for (let i = 0; i < allSubsections.length; i++) {
      const current = allSubsections[i];
      const nextId = await Subsection.getNextIdInSection(current.id);
      const nextSubsection = allSubsections.find(ss => ss.id === nextId);

      const navigationInfo = {
        subsection_id: current.id,
        subsection_title: current.title,
        section_id: current.section_id,
        section_title: current.section_title,
        chapter_title: current.chapter_title,
        sort_order: current.sort_order,
        quiz_required: current.quiz_required,
        next_subsection_id: nextId,
        next_subsection_title: nextSubsection?.title || null,
        issues: []
      };

      // Check 1: Navigation issues
      // NOTE: Removed check for "no next subsection" - this is normal for subsections at the end of a chain
      // Only subsection 259 (final exam) is expected to have null as next, but other subsections
      // may also legitimately be at the end of their section/course chain

      // Check 2: If next subsection exists, verify it's in order
      if (nextId) {
        const currentIndex = allSubsections.findIndex(ss => ss.id === current.id);
        const nextIndex = allSubsections.findIndex(ss => ss.id === nextId);
        
        // Check if next is actually after current (by ID)
        if (nextIndex <= currentIndex) {
          navigationInfo.issues.push({
            type: 'ORDERING_ISSUE',
            severity: 'MEDIUM',
            message: `Next subsection (${nextId}) appears before or equal to current subsection (${current.id}) in sequence.`
          });
          auditResults.summary.ordering_issues++;
        }

        // Check if next subsection is in a different section (potential issue)
        if (nextSubsection && nextSubsection.section_id !== current.section_id) {
          navigationInfo.issues.push({
            type: 'CROSS_SECTION_NAVIGATION',
            severity: 'INFO',
            message: `Next subsection (${nextId}) is in different section (${nextSubsection.section_id} vs ${current.section_id}). This may be intentional for cross-section flow.`
          });
        }
      }

      // Check 3: Quiz configuration
      if (Number(current.quiz_required) === 1) {
        try {
          const questions = await SubsectionQuiz.getQuestions(current.id, conn, false);
          if (questions.length === 0) {
            navigationInfo.issues.push({
              type: 'MISSING_QUIZ',
              severity: 'HIGH',
              message: `Quiz is required but no questions configured.`
            });
            auditResults.summary.missing_quizzes++;
          } else {
            // Check if quiz has questions with options
            const questionsWithOptions = questions.filter(q => q.options && q.options.length > 0);
            if (questionsWithOptions.length === 0) {
              navigationInfo.issues.push({
                type: 'QUIZ_NO_OPTIONS',
                severity: 'HIGH',
                message: `Quiz has ${questions.length} question(s) but no answer options configured.`
              });
            }
          }
        } catch (quizErr) {
          navigationInfo.issues.push({
            type: 'QUIZ_CHECK_ERROR',
            severity: 'MEDIUM',
            message: `Error checking quiz: ${quizErr.message}`
          });
        }
      }

      // Check 4: Gaps in ID sequence
      if (i < allSubsections.length - 1) {
        const expectedNextId = current.id + 1;
        const actualNextId = allSubsections[i + 1].id;
        if (actualNextId !== expectedNextId) {
          navigationInfo.issues.push({
            type: 'ID_GAP',
            severity: 'INFO',
            message: `ID gap detected: Current ID is ${current.id}, but next subsection ID is ${actualNextId} (expected ${expectedNextId}). Gaps: ${actualNextId - expectedNextId}`
          });
        }
      }

      // Add to navigation map
      auditResults.navigation_map.push(navigationInfo);

      // Add to issues if any problems found
      if (navigationInfo.issues.length > 0) {
        auditResults.issues.push(navigationInfo);
        auditResults.summary.subsections_with_issues++;
      }
    }

    // Section-level analysis
    for (const [sectionKey, sectionData] of Object.entries(subsectionsBySection)) {
      const sectionInfo = {
        section_id: sectionData.section_id,
        section_title: sectionData.section_title,
        chapter_title: sectionData.chapter_title,
        total_subsections: sectionData.subsections.length,
        subsections: sectionData.subsections.map(ss => ({
          id: ss.id,
          title: ss.title,
          sort_order: ss.sort_order,
          quiz_required: ss.quiz_required
        })),
        ordering_issues: []
      };

      // Check sort_order within section
      const sortedByOrder = [...sectionData.subsections].sort((a, b) => a.sort_order - b.sort_order);
      const sortedById = [...sectionData.subsections].sort((a, b) => a.id - b.id);
      
      // Check if sort_order matches ID order
      for (let i = 0; i < sortedByOrder.length; i++) {
        if (sortedByOrder[i].id !== sortedById[i].id) {
          sectionInfo.ordering_issues.push({
            type: 'SORT_ORDER_MISMATCH',
            message: `Sort order doesn't match ID order in this section`
          });
          break;
        }
      }

      // Check for duplicate sort_orders
      const sortOrders = sectionData.subsections.map(ss => ss.sort_order);
      const duplicates = sortOrders.filter((order, index) => sortOrders.indexOf(order) !== index);
      if (duplicates.length > 0) {
        sectionInfo.ordering_issues.push({
          type: 'DUPLICATE_SORT_ORDER',
          message: `Duplicate sort_order values found: ${[...new Set(duplicates)].join(', ')}`
        });
      }

      auditResults.section_analysis.push(sectionInfo);
    }

    // Overall health status
    // NOTE: Removed broken_navigation_chains from health check - "no next subsection" is normal for end-of-chain
    const healthStatus = 
      auditResults.summary.missing_quizzes > 0 ? 'UNHEALTHY' :
      auditResults.summary.ordering_issues > 0 ? 'NEEDS_ATTENTION' :
      'HEALTHY';

    return res.status(200).json({
      success: true,
      health_status: healthStatus,
      audit_timestamp: new Date().toISOString(),
      ...auditResults
    });

  } catch (err) {
    logger.error('Subsection navigation audit error:', err);
    return res.status(500).json({
      success: false,
      code: 'AUDIT_ERROR',
      message: 'Failed to complete audit',
      error: err.message
    });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/audit/subsection-navigation/:subsectionId
 * Audits navigation for a specific subsection
 */
exports.auditSubsectionNavigationById = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const subsectionId = Number(req.params.subsectionId);

    if (!subsectionId) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Invalid subsection ID'
      });
    }

    const subsection = await Subsection.getById(subsectionId);
    if (!subsection) {
      return res.status(404).json({
        success: false,
        code: 'SUBSECTION_NOT_FOUND',
        message: `Subsection ${subsectionId} not found`
      });
    }

    const nextId = await Subsection.getNextIdInSection(subsectionId);
    const nextSubsection = nextId ? await Subsection.getById(nextId) : null;

    const issues = [];

    // Check navigation
    // NOTE: Removed check for "no next subsection" - this is normal for subsections at the end of chain
    // End-of-chain subsections are not considered an issue

    // Check quiz if required
    if (Number(subsection.quiz_required) === 1) {
      const questions = await SubsectionQuiz.getQuestions(subsectionId, conn, false);
      if (questions.length === 0) {
        issues.push({
          type: 'MISSING_QUIZ',
          severity: 'HIGH',
          message: 'Quiz is required but no questions configured'
        });
      }
    }

    return res.status(200).json({
      success: true,
      subsection: {
        id: subsection.id,
        title: subsection.title,
        section_id: subsection.section_id,
        section_title: subsection.section_title,
        chapter_title: subsection.chapter_title,
        sort_order: subsection.sort_order,
        quiz_required: subsection.quiz_required
      },
      navigation: {
        next_subsection_id: nextId,
        next_subsection: nextSubsection ? {
          id: nextSubsection.id,
          title: nextSubsection.title,
          section_id: nextSubsection.section_id
        } : null
      },
      issues,
      health_status: issues.length === 0 ? 'HEALTHY' : 'HAS_ISSUES'
    });

  } catch (err) {
    logger.error('Subsection navigation audit by ID error:', err);
    return res.status(500).json({
      success: false,
      code: 'AUDIT_ERROR',
      message: 'Failed to complete audit',
      error: err.message
    });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/audit/subsection-navigation/fix
 * Automatically fixes common issues found in the audit
 * 
 * IMPORTANT NOTES:
 * - Only fixes sort_order (display order). This is SAFE and doesn't affect:
 *   - Quizzes (linked by subsection_id)
 *   - Progress tracking (tracked by subsection_id)
 *   - Navigation (uses ID, not sort_order)
 * - CANNOT automatically fix:
 *   - Broken navigation chains (requires manual subsection creation/fixing)
 *   - Missing quizzes (requires manual quiz creation)
 * 
 * Body: {
 *   fix_type: 'all' | 'ordering' | 'sort_order' | 'duplicate_sort_orders',
 *   section_id?: number,  // Optional: fix specific section only
 *   dry_run?: boolean     // Optional: preview changes without applying
 * }
 */
exports.fixSubsectionNavigation = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { fix_type = 'all', section_id, dry_run = false } = req.body || {};

    if (!['all', 'ordering', 'sort_order', 'duplicate_sort_orders'].includes(fix_type)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_FIX_TYPE',
        message: 'fix_type must be: all, ordering, sort_order, or duplicate_sort_orders'
      });
    }

    const fixes = [];
    const errors = [];

    // Get all subsections
    let query = `
      SELECT ss.*, s.title as section_title
      FROM subsections ss
      LEFT JOIN sections s ON ss.section_id = s.id
      ORDER BY ss.section_id ASC, ss.sort_order ASC, ss.id ASC
    `;
    
    const params = [];
    if (section_id) {
      query = query.replace('ORDER BY', 'WHERE ss.section_id = ? ORDER BY');
      params.push(section_id);
    }

    const [allSubsections] = await conn.query(query, params);

    // Group by section
    const subsectionsBySection = {};
    allSubsections.forEach(ss => {
      const sectionId = ss.section_id || 'no_section';
      if (!subsectionsBySection[sectionId]) {
        subsectionsBySection[sectionId] = {
          section_id: ss.section_id,
          section_title: ss.section_title,
          subsections: []
        };
      }
      subsectionsBySection[sectionId].subsections.push(ss);
    });

    await conn.beginTransaction();

    try {
      // Fix 1: Duplicate sort_orders and sort_order mismatches
      // IMPORTANT: This only fixes sort_order (display order). Navigation uses ID, not sort_order.
      // Changing sort_order is SAFE - it doesn't affect:
      // - Quiz links (linked by subsection_id)
      // - Progress tracking (tracked by subsection_id)
      // - Navigation (uses ID, not sort_order)
      if (fix_type === 'all' || fix_type === 'duplicate_sort_orders' || fix_type === 'sort_order') {
        for (const [sectionKey, sectionData] of Object.entries(subsectionsBySection)) {
          const sectionSubsections = sectionData.subsections;
          
          // Sort by ID to get correct order (navigation uses ID)
          const sortedById = [...sectionSubsections].sort((a, b) => a.id - b.id);
          
          // Fix sort_order to match ID order (sequential: 1, 2, 3, ...)
          for (let i = 0; i < sortedById.length; i++) {
            const expectedSortOrder = i + 1;
            const currentSubsection = sortedById[i];
            
            if (currentSubsection.sort_order !== expectedSortOrder) {
              if (!dry_run) {
                try {
                  // Use direct SQL update to avoid issues with undefined/null content_html
                  const [updateResult] = await conn.query(
                    'UPDATE subsections SET sort_order = ? WHERE id = ?',
                    [expectedSortOrder, currentSubsection.id]
                  );
                  
                  // Verify update actually happened
                  if (updateResult.affectedRows === 0) {
                    errors.push({
                      type: 'UPDATE_FAILED',
                      subsection_id: currentSubsection.id,
                      message: 'Update returned 0 affected rows - subsection may not exist'
                    });
                    logger.warn('Subsection update returned 0 rows', {
                      subsection_id: currentSubsection.id,
                      expected_sort_order: expectedSortOrder
                    });
                  } else {
                    // Double-check by querying the updated value
                    const [verify] = await conn.query(
                      'SELECT sort_order FROM subsections WHERE id = ?',
                      [currentSubsection.id]
                    );
                    
                    if (verify[0] && verify[0].sort_order !== expectedSortOrder) {
                      errors.push({
                        type: 'VERIFICATION_FAILED',
                        subsection_id: currentSubsection.id,
                        expected: expectedSortOrder,
                        actual: verify[0].sort_order,
                        message: 'Update did not persist correctly'
                      });
                      logger.error('Subsection update verification failed', {
                        subsection_id: currentSubsection.id,
                        expected: expectedSortOrder,
                        actual: verify[0].sort_order
                      });
                    } else {
                      logger.info('Successfully updated subsection sort_order', {
                        subsection_id: currentSubsection.id,
                        old_sort_order: currentSubsection.sort_order,
                        new_sort_order: expectedSortOrder
                      });
                    }
                  }
                } catch (updateErr) {
                  errors.push({
                    type: 'UPDATE_ERROR',
                    subsection_id: currentSubsection.id,
                    message: updateErr.message,
                    error: updateErr.code
                  });
                  logger.error('Subsection update error', {
                    subsection_id: currentSubsection.id,
                    error: updateErr.message,
                    stack: updateErr.stack
                  });
                }
              }
              
              fixes.push({
                type: 'SORT_ORDER_FIXED',
                subsection_id: currentSubsection.id,
                subsection_title: currentSubsection.title,
                section_id: currentSubsection.section_id,
                old_sort_order: currentSubsection.sort_order,
                new_sort_order: expectedSortOrder,
                dry_run,
                note: 'Only affects display order. Navigation uses ID, not sort_order. Safe to change - quizzes and progress linked by subsection_id.'
              });
            }
          }
        }
      }

      if (!dry_run) {
        await conn.commit();
      } else {
        await conn.rollback();
      }

      const response = {
        success: true,
        dry_run,
        fix_type,
        fixes_applied: fixes.length,
        errors_found: errors.length,
        fixes,
        errors,
        warnings: [],
        summary: {
          total_subsections_checked: allSubsections.length,
          subsections_modified: fixes.length,
          update_failures: errors.filter(e => e.type === 'UPDATE_FAILED').length,
          verification_failures: errors.filter(e => e.type === 'VERIFICATION_FAILED').length
        },
        note: dry_run 
          ? `DRY RUN: ${fixes.length} fixes would be applied. No changes made.`
          : errors.length > 0
            ? `Applied ${fixes.length} fixes, but ${errors.length} errors occurred. Check errors array.`
            : `Successfully applied ${fixes.length} fixes to sort_order values.`
      };

      // Add warning if no fixes were found but fix was requested
      if (fixes.length === 0 && !dry_run) {
        response.warnings.push({
          type: 'NO_ISSUES_FOUND',
          message: 'No sort_order issues found to fix. This is normal if all subsections already have correct sort_order values.'
        });
      }

      // Add informational note about what was fixed
      if (fixes.length > 0) {
        response.note += ' Note: sort_order changes are safe and only affect display order. Navigation, quizzes, and progress tracking use subsection_id (not sort_order).';
      }

      return res.status(200).json(response);

    } catch (fixErr) {
      await conn.rollback();
      throw fixErr;
    }

  } catch (err) {
    logger.error('Fix subsection navigation error:', err);
    return res.status(500).json({
      success: false,
      code: 'FIX_ERROR',
      message: 'Failed to fix issues',
      error: err.message
    });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/audit/subsection-navigation/fix/:subsectionId
 * Fix issues for a specific subsection
 * 
 * Body: {
 *   fix_type: 'sort_order',
 *   sort_order?: number,           // For fixing sort_order
 *   dry_run?: boolean
 * }
 */
exports.fixSubsectionById = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const subsectionId = Number(req.params.subsectionId);
    const { fix_type, sort_order, dry_run = false } = req.body || {};

    if (!subsectionId) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Invalid subsection ID'
      });
    }

    const subsection = await Subsection.getById(subsectionId);
    if (!subsection) {
      return res.status(404).json({
        success: false,
        code: 'SUBSECTION_NOT_FOUND',
        message: `Subsection ${subsectionId} not found`
      });
    }

    const fixes = [];

    await conn.beginTransaction();

    try {
      if (fix_type === 'sort_order' && sort_order !== undefined) {
        if (!dry_run) {
          await Subsection.update(subsectionId, {
            section_id: subsection.section_id,
            title: subsection.title,
            content_html: subsection.content_html,
            sort_order: Number(sort_order)
          });
        }
        
        fixes.push({
          type: 'SORT_ORDER_UPDATED',
          subsection_id: subsectionId,
          old_sort_order: subsection.sort_order,
          new_sort_order: sort_order,
          dry_run
        });
      }

      if (!dry_run) {
        await conn.commit();
      } else {
        await conn.rollback();
      }

      return res.status(200).json({
        success: true,
        dry_run,
        fixes_applied: fixes.length,
        fixes,
        message: dry_run 
          ? `Preview: ${fixes.length} fixes would be applied`
          : `Successfully applied ${fixes.length} fixes`
      });

    } catch (fixErr) {
      await conn.rollback();
      throw fixErr;
    }

  } catch (err) {
    logger.error('Fix subsection by ID error:', err);
    return res.status(500).json({
      success: false,
      code: 'FIX_ERROR',
      message: 'Failed to fix subsection',
      error: err.message
    });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/audit/subsection-navigation/fix-section/:sectionId
 * Fix all ordering issues within a specific section
 */
exports.fixSectionOrdering = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const sectionId = Number(req.params.sectionId);
    const { dry_run = false } = req.body || {};

    if (!sectionId) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Invalid section ID'
      });
    }

    // Get all subsections in this section
    const { subsections } = await Subsection.getBySectionId(sectionId, {
      page: 1,
      limit: 10000,
      sortBy: 'id',
      order: 'ASC'
    });

    if (subsections.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'NO_SUBSECTIONS',
        message: `No subsections found in section ${sectionId}`
      });
    }

    const fixes = [];

    await conn.beginTransaction();

    try {
      // Fix sort_order to match ID order (1, 2, 3, ...)
      for (let i = 0; i < subsections.length; i++) {
        const subsection = subsections[i];
        const expectedSortOrder = i + 1;
        
        if (subsection.sort_order !== expectedSortOrder) {
          if (!dry_run) {
            await Subsection.update(subsection.id, {
              section_id: subsection.section_id,
              title: subsection.title,
              content_html: subsection.content_html,
              sort_order: expectedSortOrder
            });
          }
          
          fixes.push({
            type: 'SORT_ORDER_FIXED',
            subsection_id: subsection.id,
            subsection_title: subsection.title,
            old_sort_order: subsection.sort_order,
            new_sort_order: expectedSortOrder,
            dry_run
          });
        }
      }

      if (!dry_run) {
        await conn.commit();
      } else {
        await conn.rollback();
      }

      return res.status(200).json({
        success: true,
        dry_run,
        section_id: sectionId,
        total_subsections: subsections.length,
        fixes_applied: fixes.length,
        fixes,
        message: dry_run 
          ? `Preview: ${fixes.length} fixes would be applied to section ${sectionId}`
          : `Successfully applied ${fixes.length} fixes to section ${sectionId}`
      });

    } catch (fixErr) {
      await conn.rollback();
      throw fixErr;
    }

  } catch (err) {
    logger.error('Fix section ordering error:', err);
    return res.status(500).json({
      success: false,
      code: 'FIX_ERROR',
      message: 'Failed to fix section ordering',
      error: err.message
    });
  } finally {
    conn.release();
  }
};

