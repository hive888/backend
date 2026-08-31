const db = require('../config/database');

const DB_MAP = {
    fullName: 'full_name', email: 'email', phone: 'phone', country: 'country', city: 'city', nationality: 'nationality',
    gender: 'gender', dateOfBirth: 'date_of_birth', linkedin: 'linkedin', github: 'github', portfolio: 'portfolio', cvUrl: 'cv_url',
    primaryRole: 'primary_role', secondarySkills: 'secondary_skills', yearsExperience: 'years_experience',
    employmentStatus: 'employment_status', currentCompany: 'current_company', currentJobTitle: 'current_job_title',
    remoteExperience: 'remote_experience', internationalClients: 'international_clients', educationLevel: 'education_level',
    fieldOfStudy: 'field_of_study', university: 'university', graduationYear: 'graduation_year', hasCertification: 'has_certification',
    certifications: 'certifications', availableRemote: 'available_remote', hoursPerWeek: 'hours_per_week', noticePeriod: 'notice_period',
    preferredWorkType: 'preferred_work_type', expectedSalaryUsd: 'expected_salary_usd', preferredPayment: 'preferred_payment',
    englishLevel: 'english_level', otherLanguagesText: 'other_languages_text', englishMeetings: 'english_meetings', hasLaptop: 'has_laptop',
    stableInternet: 'stable_internet', backupInternet: 'backup_internet', powerBackup: 'power_backup', canAttendMeetings: 'can_attend_meetings',
    applyingRole: 'applying_role', techLanguages: 'tech_languages', frameworks: 'frameworks', databases: 'databases',
    devopsTools: 'devops_tools', productionProjects: 'production_projects', deployedApp: 'deployed_app', usedGitTeam: 'used_git_team',
    builtApi: 'built_api', workedLargeSystem: 'worked_large_system', restApiAnswer: 'rest_api_answer', sqlNosqlAnswer: 'sql_nosql_answer',
    authenticationAnswer: 'authentication_answer', versionControlAnswer: 'version_control_answer', deploymentAnswer: 'deployment_answer',
    backendAnswer: 'backend_answer', frontendAnswer: 'frontend_answer', devopsAnswer: 'devops_answer', debugAnswer: 'debug_answer',
    difficultTaskAnswer: 'difficult_task_answer', learnNewTechAnswer: 'learn_new_tech_answer', deadlineAnswer: 'deadline_answer',
    complexSystemDescription: 'complex_system_description', complexSystemRole: 'complex_system_role', complexSystemTech: 'complex_system_tech',
    complexSystemProblems: 'complex_system_problems', readyTechTest: 'ready_tech_test', readyLiveCoding: 'ready_live_coding',
    readyProjectTrial: 'ready_project_trial', workedInTeam: 'worked_in_team', workedRemoteTeam: 'worked_remote_team',
    collaborationTools: 'collaboration_tools', disagreementHandling: 'disagreement_handling', mistakeHandling: 'mistake_handling',
    finishTasks: 'finish_tasks', deadlineCloseAction: 'deadline_close_action', timeManagement: 'time_management', codingStandards: 'coding_standards',
    strictRequirements: 'strict_requirements', attendMeetingsReadiness: 'attend_meetings_readiness', timezoneReadiness: 'timezone_readiness',
    quietWorkspace: 'quiet_workspace', longTermProject: 'long_term_project', readyToSignContract: 'ready_to_sign_contract',
    unhappyClientAnswer: 'unhappy_client_answer', dontUnderstandTaskAnswer: 'dont_understand_task_answer', correctionReactionAnswer: 'correction_reaction_answer',
    urgentExtraTimeAnswer: 'urgent_extra_time_answer', betterOfferAnswer: 'better_offer_answer', whySwafri: 'why_swafri',
    desiredProjects: 'desired_projects', uniqueness: 'uniqueness', careerGoals: 'career_goals', confirmTrueAnswers: 'confirm_true_answers',
    agreeScreening: 'agree_screening', agreeInterview: 'agree_interview', agreeRemoteContract: 'agree_remote_contract', readinessScore: 'readiness_score',
    selectedSkills: 'selected_skills', answers: 'answers', projectUrl: 'project_url', projectDescription: 'project_description',
    behavioralScores: 'behavioral_scores', rawPayload: 'raw_payload'
};

// Columns that are Int @db.SmallInt (0/1) in the DB but arrive as real JS booleans
const BOOLEAN_FIELDS = new Set(['confirm_true_answers', 'agree_screening', 'agree_interview', 'agree_remote_contract']);

class Assessment {
    static async create(payload) {
        const dbFields = [];
        const values = [];

        // Map payload to db schema
        Object.keys(payload).forEach(key => {
            if (DB_MAP[key]) {
                const dbField = DB_MAP[key];
                dbFields.push(dbField);
                const val = payload[key];
                if (BOOLEAN_FIELDS.has(dbField)) {
                    values.push(val ? 1 : 0);
                } else if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
                    // Stringify JSON arrays for techLanguages, frameworks, databases, devopsTools, etc.
                    values.push(JSON.stringify(val));
                } else {
                    values.push(val);
                }
            }
        });

        if (dbFields.length === 0) {
            throw new Error('No valid assessment fields provided');
        }

        const placeholders = dbFields.map(() => '?').join(', ');
        const sql = `INSERT INTO assessments (${dbFields.join(', ')}) VALUES (${placeholders})`;

        const [result] = await db.query(sql, values);
        return result.insertId;
    }
}

module.exports = Assessment;
