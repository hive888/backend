CREATE TABLE IF NOT EXISTS project_pool (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creator_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  deliverables JSON NOT NULL,
  timeline VARCHAR(100) NOT NULL,
  team_structure VARCHAR(255) NOT NULL,
  budget VARCHAR(100) NOT NULL,
  funding_goal VARCHAR(100) DEFAULT NULL,
  funding_raised VARCHAR(100) DEFAULT '0',
  mentor_needed TINYINT(1) DEFAULT 0,
  required_skills JSON NOT NULL,
  project_logo_url VARCHAR(512) DEFAULT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0=Pending, 1=Active, 2=Completed, 3=Rejected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role_type VARCHAR(50) NOT NULL COMMENT 'contributor, investor, mentor',
  motivation TEXT NOT NULL,
  contribution_details TEXT DEFAULT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0=Pending, 1=Accepted, 2=Rejected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES project_pool(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_role_project (user_id, project_id, role_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
