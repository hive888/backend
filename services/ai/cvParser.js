/**
 * CV Parser Service
 * Analyzes CV files to extract structured information
 */

const logger = require('../../utils/logger');
const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { getWorkingModel } = require('./geminiModelDetector');

// Google Gemini client (optional)
let gemini = null;
let workingModel = null;

// Initialize Gemini if available
async function initGemini() {
  try {
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      // Detect available model
      workingModel = await getWorkingModel(gemini);
      
      if (workingModel) {
        logger.info(`Google Gemini initialized for CV analysis with model: ${workingModel}`);
      } else {
        logger.warn('Google Gemini initialized but no working model found');
      }
    }
  } catch (error) {
    logger.warn('Gemini initialization failed for CV parsing:', error.message);
  }
}

initGemini();

/**
 * Analyze CV and extract structured data
 */
async function analyzeCV(cvUrl, cvFilePath = null, talentId = null) {
  try {
    // 1. Extract text from CV
    const cvText = await extractTextFromCV(cvUrl, cvFilePath);

    if (!cvText || cvText.trim().length < 50) {
      throw new Error('CV text extraction failed or CV is too short');
    }

    // 2. Use AI to extract structured data
    let extracted = null;
    if (gemini) {
      try {
        extracted = await extractStructuredData(cvText);
      } catch (error) {
        logger.warn('AI CV extraction failed, using rule-based:', error.message);
        extracted = null;
      }
    }

    // 3. Fallback to rule-based extraction
    if (!extracted) {
      extracted = fallbackExtraction(cvText);
    }

    // 4. Enhance with rule-based extraction
    const enhanced = enhanceExtraction(cvText, extracted);

    // 5. Generate suggestions if talent ID provided
    const suggestedUpdates = talentId 
      ? await generateSuggestions(talentId, enhanced)
      : [];

    return {
      extracted_data: {
        skills: enhanced.skills || [],
        experience_years: enhanced.experience_years || null,
        education: enhanced.education || [],
        certifications: enhanced.certifications || [],
        work_experience: enhanced.work_experience || [],
        languages: enhanced.languages || [],
        summary: enhanced.summary || generateSummary(cvText)
      },
      confidence: {
        overall: enhanced.confidence || 0.7,
        skills: enhanced.skills_confidence || 0.9,
        experience: enhanced.experience_confidence || 0.85,
        education: enhanced.education_confidence || 0.8
      },
      suggested_updates: suggestedUpdates,
      processed_at: new Date().toISOString(),
      cached: false
    };
  } catch (error) {
    logger.error('CV analysis error:', error);
    throw new Error('CV processing failed: ' + error.message);
  }
}

/**
 * Extract text from CV file
 */
async function extractTextFromCV(cvUrl, cvFilePath) {
  let fileBuffer = null;

  // If file path provided and not a URL, read from filesystem
  if (cvFilePath && !cvFilePath.startsWith('http://') && !cvFilePath.startsWith('https://')) {
    try {
      fileBuffer = await fs.readFile(cvFilePath);
    } catch (error) {
      throw new Error(`Failed to read CV file: ${error.message}`);
    }
  } 
  // If URL provided, or file path is a URL, download it
  else if (cvUrl || (cvFilePath && (cvFilePath.startsWith('http://') || cvFilePath.startsWith('https://')))) {
    const urlToDownload = cvUrl || cvFilePath;
    fileBuffer = await downloadFile(urlToDownload);
  } else {
    throw new Error('Either cvUrl or cvFilePath must be provided');
  }

  // Determine file type and parse
  const isUrl = cvUrl || (cvFilePath && (cvFilePath.startsWith('http://') || cvFilePath.startsWith('https://')));
  const fileExtension = isUrl 
    ? path.extname(new URL(cvUrl || cvFilePath).pathname).toLowerCase()
    : path.extname(cvFilePath).toLowerCase();

  if (fileExtension === '.pdf') {
    return await parsePDF(fileBuffer);
  } else if (fileExtension === '.txt') {
    return fileBuffer.toString('utf-8');
  } else if (fileExtension === '.docx') {
    // DOCX parsing would require additional library
    throw new Error('DOCX parsing not yet implemented. Please use PDF or TXT format.');
  } else {
    // Try to parse as text
    return fileBuffer.toString('utf-8');
  }
}

/**
 * Download file from URL
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    // CloudFront and other CDNs might block requests with empty/missing User-Agent headers
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    
    protocol.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Parse PDF file
 */
async function parsePDF(buffer) {
  try {
    // Try pdf-parse if available
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    // Fallback: try to extract text (basic)
    logger.warn('PDF parsing library not available, using basic extraction');
    throw new Error('PDF parsing requires pdf-parse library. Install with: npm install pdf-parse');
  }
}

/**
 * Extract structured data using AI
 */
async function extractStructuredData(cvText) {
  if (!gemini) return null;

  // Get working model (will detect if not already cached)
  const modelName = workingModel || await getWorkingModel(gemini) || process.env.GEMINI_MODEL || 'gemini-pro';
  
  if (!modelName) {
    logger.warn('[CV Parser] No working Gemini model available');
    return null;
  }

  const model = gemini.getGenerativeModel({ model: modelName });

  const prompt = `You are an expert CV/resume parser AI with deep expertise in extracting structured information from professional documents.

TASK: Perform a comprehensive, detailed extraction of all information from this CV/resume.

CV CONTENT:
${cvText.substring(0, 8000)} ${cvText.length > 8000 ? '\n\n[Content truncated for length]' : ''}

EXTRACTION REQUIREMENTS:

1. **Skills**: Extract ALL technical and professional skills:
   - Programming languages (with proficiency level if mentioned)
   - Frameworks, libraries, and tools
   - Databases and data technologies
   - Cloud platforms and services
   - DevOps and infrastructure tools
   - Methodologies (Agile, Scrum, etc.)
   - Domain-specific skills
   - Soft skills and competencies

2. **Experience Years**: Calculate total years of professional experience:
   - Sum all relevant work experience
   - Include internships if substantial
   - Be accurate and precise

3. **Education**: Extract complete education history:
   - Degree level (Bachelor's, Master's, PhD, etc.)
   - Field of study
   - Institution name
   - Graduation year (or expected year)
   - Any honors, distinctions, or GPA if mentioned

4. **Certifications**: Extract all professional certifications:
   - Certification name
   - Issuing organization
   - Year obtained
   - Expiration date if mentioned

5. **Work Experience**: Extract detailed work history:
   - Company/organization name
   - Job title/position
   - Employment duration (start and end dates)
   - Detailed description of responsibilities and achievements
   - Technologies used
   - Key accomplishments

6. **Languages**: Extract all languages spoken:
   - Language name
   - Proficiency level if mentioned (native, fluent, conversational, etc.)

7. **Summary**: Create a comprehensive professional summary (3-4 sentences):
   - Highlight key qualifications
   - Summarize experience and expertise
   - Note specializations
   - Include career focus/objectives

8. **Additional Information**: Extract any other relevant details:
   - Projects and portfolios
   - Publications
   - Awards and recognition
   - Professional memberships
   - Volunteer work
   - Interests and hobbies (if professionally relevant)

ANALYSIS GUIDELINES:
- Be thorough and extract ALL information
- Maintain accuracy and preserve original details
- Infer logical connections where appropriate
- Standardize formats (e.g., skill names, date formats)
- Identify implicit skills from job descriptions
- Note any gaps or missing information

OUTPUT FORMAT:
Return a comprehensive JSON object with all fields above. Be detailed, accurate, and complete.

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no additional text. Pure JSON only.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4000, // Increased for comprehensive CV data extraction
      responseMimeType: 'application/json'
    }
  });

  const response = await result.response;
  const text = response.text();
  
  try {
    return JSON.parse(text);
  } catch (error) {
    // If JSON parsing fails, try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}



/**
 * Fallback rule-based extraction
 */
function fallbackExtraction(cvText) {
  return {
    skills: extractSkillsFromText(cvText),
    experience_years: extractExperienceYears(cvText),
    education: extractEducation(cvText),
    certifications: extractCertifications(cvText),
    work_experience: extractWorkExperience(cvText),
    languages: extractLanguages(cvText),
    summary: generateSummary(cvText)
  };
}

/**
 * Enhance extraction with additional rules
 */
function enhanceExtraction(cvText, aiExtracted) {
  const ruleBased = fallbackExtraction(cvText);

  return {
    ...aiExtracted,
    skills: [...new Set([...(aiExtracted.skills || []), ...ruleBased.skills])],
    experience_years: aiExtracted.experience_years || ruleBased.experience_years,
    education: aiExtracted.education || ruleBased.education,
    certifications: aiExtracted.certifications || ruleBased.certifications,
    work_experience: aiExtracted.work_experience || ruleBased.work_experience,
    languages: aiExtracted.languages || ruleBased.languages,
    summary: aiExtracted.summary || ruleBased.summary,
    confidence: calculateConfidence(aiExtracted),
    skills_confidence: 0.9,
    experience_confidence: 0.85,
    education_confidence: 0.8
  };
}

/**
 * Extract skills from text
 */
function extractSkillsFromText(text) {
  const commonSkills = [
    'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'JavaScript',
    'TypeScript', 'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'AWS', 'Docker',
    'Kubernetes', 'GraphQL', 'REST API', 'Express', 'Next.js', 'Nuxt',
    'Django', 'Flask', 'Spring', 'Laravel', 'PHP', 'Ruby', 'Go', 'Rust',
    'Swift', 'Kotlin', 'React Native', 'Flutter', 'iOS', 'Android',
    'HTML', 'CSS', 'SASS', 'LESS', 'Tailwind', 'Bootstrap', 'Git',
    'CI/CD', 'Jenkins', 'GitLab', 'GitHub Actions', 'Terraform', 'Ansible',
    'Machine Learning', 'AI', 'TensorFlow', 'PyTorch', 'Data Science'
  ];

  const foundSkills = [];
  const lowerText = text.toLowerCase();

  for (const skill of commonSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      foundSkills.push(skill);
    }
  }

  return foundSkills;
}

/**
 * Extract experience years
 */
function extractExperienceYears(text) {
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?experience/i,
    /experience[:\s]+(\d+)\+?\s*(?:years?|yrs?)/i,
    /(\d+)\+?\s*(?:years?|yrs?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const years = parseInt(match[1]);
      if (years > 0 && years < 50) {
        return years;
      }
    }
  }

  return null;
}

/**
 * Extract education information
 */
function extractEducation(text) {
  const education = [];
  const degreePatterns = [
    /(?:Bachelor|B\.?S\.?|B\.?Sc\.?|B\.?A\.?)\s+(?:of\s+)?(?:Science|Arts|Engineering|Computer Science)/i,
    /(?:Master|M\.?S\.?|M\.?Sc\.?|M\.?A\.?)\s+(?:of\s+)?(?:Science|Arts|Engineering|Computer Science)/i,
    /(?:PhD|Ph\.?D\.?|Doctorate)\s+(?:in\s+)?(?:Computer Science|Engineering|Science)/i
  ];

  for (const pattern of degreePatterns) {
    const match = text.match(pattern);
    if (match) {
      education.push({
        degree: match[0],
        field: 'Computer Science',
        institution: 'Unknown',
        year: extractYear(text, match.index)
      });
    }
  }

  return education;
}

/**
 * Extract certifications
 */
function extractCertifications(text) {
  const certifications = [];
  const certPatterns = [
    /(?:AWS|Amazon Web Services)\s+(?:Certified|Certification)/i,
    /(?:Google Cloud|GCP)\s+(?:Certified|Certification)/i,
    /(?:Microsoft|Azure)\s+(?:Certified|Certification)/i
  ];

  for (const pattern of certPatterns) {
    const match = text.match(pattern);
    if (match) {
      certifications.push({
        name: match[0],
        issuer: match[0].split(' ')[0],
        year: extractYear(text, match.index)
      });
    }
  }

  return certifications;
}

/**
 * Extract work experience
 */
function extractWorkExperience(text) {
  // Basic extraction - can be enhanced
  const workExp = [];
  const companyPattern = /(?:at|with|worked at|company:)\s+([A-Z][A-Za-z\s&]+)/g;
  const matches = [...text.matchAll(companyPattern)];

  matches.slice(0, 5).forEach(match => {
    workExp.push({
      company: match[1].trim(),
      position: 'Software Engineer',
      duration: 'Unknown',
      description: ''
    });
  });

  return workExp;
}

/**
 * Extract languages
 */
function extractLanguages(text) {
  const languages = [];
  const commonLanguages = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Chinese', 'Japanese', 'Arabic'];
  
  for (const lang of commonLanguages) {
    if (text.includes(lang)) {
      languages.push(lang);
    }
  }

  return languages.length > 0 ? languages : ['English']; // Default
}

/**
 * Extract year from text near position
 */
function extractYear(text, position) {
  const yearPattern = /\b(19|20)\d{2}\b/;
  const snippet = text.substring(Math.max(0, position - 50), position + 50);
  const match = snippet.match(yearPattern);
  return match ? parseInt(match[0]) : null;
}

/**
 * Generate summary
 */
function generateSummary(cvText) {
  const sentences = cvText.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length > 0) {
    return sentences.slice(0, 2).join('. ').trim() + '.';
  }
  return 'Professional with experience in software development.';
}

/**
 * Calculate confidence
 */
function calculateConfidence(extracted) {
  let confidence = 0.5;
  if (extracted.skills?.length > 0) confidence += 0.2;
  if (extracted.experience_years) confidence += 0.15;
  if (extracted.education?.length > 0) confidence += 0.15;
  return Math.min(confidence, 1.0);
}

/**
 * Generate suggestions for talent profile updates
 */
async function generateSuggestions(talentId, extracted) {
  // This would require fetching the talent from database
  // For now, return basic suggestions
  const suggestions = [];

  if (extracted.skills && extracted.skills.length > 0) {
    suggestions.push({
      field: 'skills',
      current_value: [],
      suggested_value: extracted.skills,
      reason: 'CV contains skills not in profile'
    });
  }

  return suggestions;
}

module.exports = { analyzeCV };

