import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
};

const DB_NAME = 'crm_management';

async function seed() {
  // Step 1: Connect without database to create it
  const initConn = await mysql.createConnection(DB_CONFIG);

  console.log('Creating database...');
  await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await initConn.end();

  // Step 2: Reconnect with the database selected
  const conn = await mysql.createConnection({ ...DB_CONFIG, database: DB_NAME });

  // Create tables
  console.log('Creating tables...');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255),
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role VARCHAR(50) NOT NULL,
      feature VARCHAR(100) NOT NULL,
      can_read BOOLEAN DEFAULT FALSE,
      can_write BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_role_feature (role, feature)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_site_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      wp_user_id VARCHAR(50) NOT NULL,
      site_id VARCHAR(50) NOT NULL,
      app_role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_site (wp_user_id, site_id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS wp_sites (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(500) NOT NULL,
      username VARCHAR(255),
      app_password VARCHAR(255),
      is_default TINYINT(1) DEFAULT 0,
      assigned_admins JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      user_type ENUM('super_admin', 'wp_user') NOT NULL DEFAULT 'super_admin',
      token_hash VARCHAR(64) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      invalidated_at TIMESTAMP NULL,
      UNIQUE KEY unique_token (token_hash),
      INDEX idx_user_active (user_id, user_type, is_active),
      INDEX idx_token_active (token_hash, is_active)
  `);

  // Seed super admin
  console.log('Seeding super admin...');
  const passwordHash = await bcrypt.hash('admin123', 10);

  await conn.execute(
    `INSERT INTO super_admins(username, email, password_hash) VALUES(?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    ['superadmin', 'superadmin@crm.local', passwordHash]
  );

  // Seed default permission matrix
  console.log('Seeding permission matrix...');

  const roles = ['admin', 'lead_manager', 'seo_manager', 'sales_person', 'seo_person', 'client'];
  const features = ['leads', 'users', 'activity_logs', 'subscriptions', 'seo_meta_tags', 'blogs', 'sites', 'ip_security', 'permissions'];

  const defaultPerms: Record<string, Record<string, { r: boolean; w: boolean }>> = {
    admin: {
      leads: { r: true, w: true },
      users: { r: true, w: true },
      activity_logs: { r: true, w: true },
      subscriptions: { r: true, w: true },
      seo_meta_tags: { r: true, w: true },
      blogs: { r: true, w: true },
      sites: { r: true, w: true },
      ip_security: { r: true, w: true },
      permissions: { r: false, w: false },
    },
    lead_manager: {
      leads: { r: true, w: true },
      users: { r: true, w: false },
      activity_logs: { r: true, w: false },
      subscriptions: { r: false, w: false },
      seo_meta_tags: { r: false, w: false },
      blogs: { r: false, w: false },
      sites: { r: false, w: false },
      ip_security: { r: false, w: false },
      permissions: { r: false, w: false },
    },
    seo_manager: {
      leads: { r: false, w: false },
      users: { r: true, w: false },
      activity_logs: { r: true, w: false },
      subscriptions: { r: false, w: false },
      seo_meta_tags: { r: true, w: true },
      blogs: { r: true, w: true },
      sites: { r: false, w: false },
      ip_security: { r: false, w: false },
      permissions: { r: false, w: false },
    },
    sales_person: {
      leads: { r: true, w: true },
      users: { r: true, w: false },
      activity_logs: { r: false, w: false },
      subscriptions: { r: false, w: false },
      seo_meta_tags: { r: false, w: false },
      blogs: { r: false, w: false },
      sites: { r: false, w: false },
      ip_security: { r: false, w: false },
      permissions: { r: false, w: false },
    },
    seo_person: {
      leads: { r: false, w: false },
      users: { r: true, w: false },
      activity_logs: { r: false, w: false },
      subscriptions: { r: false, w: false },
      seo_meta_tags: { r: true, w: true },
      blogs: { r: true, w: true },
      sites: { r: false, w: false },
      ip_security: { r: false, w: false },
      permissions: { r: false, w: false },
    },
    client: {
      leads: { r: true, w: false },
      users: { r: false, w: false },
      activity_logs: { r: false, w: false },
      subscriptions: { r: true, w: false },
      seo_meta_tags: { r: false, w: false },
      blogs: { r: false, w: false },
      sites: { r: false, w: false },
      ip_security: { r: false, w: false },
      permissions: { r: false, w: false },
    },
  };

  for (const role of roles) {
    for (const feature of features) {
      const perm = defaultPerms[role]?.[feature] ?? { r: false, w: false };
      await conn.execute(
        `INSERT INTO role_permissions(role, feature, can_read, can_write) VALUES(?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE can_read = VALUES(can_read), can_write = VALUES(can_write)`,
        [role, feature, perm.r, perm.w]
      );
    }
  }

  console.log('Seed complete!');
  console.log('Super Admin credentials: username=superadmin, password=admin123');
  await conn.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
