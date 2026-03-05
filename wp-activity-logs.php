<?php
/**
 * Plugin Name: Activity Logs API
 * Description: Provides REST API endpoints to store and fetch CRM activity logs in WordPress. Includes Leads Management.
 * Version: 1.3.0
 * Author: DMUS Dev Team
 */

if (!defined('ABSPATH'))
    exit;

/**
 * Fix for Authorization header stripping on some hosts
 */
add_filter('rest_pre_dispatch', function ($result, $server, $request) {
    if (empty($request->get_header('authorization'))) {
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $request->set_header('authorization', $_SERVER['HTTP_AUTHORIZATION']);
        }
        elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $request->set_header('authorization', $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
        }
    }
    return $result;
}, 10, 3);

/**
 * Handle CORS for custom endpoints
 */
add_action('init', function () {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE, PATCH");
    header("Access-Control-Allow-Headers: Authorization, Content-Type, x-crm-api-key");
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        status_header(200);
        exit;
    }
});

add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT, PATCH');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, x-crm-api-key');
            return $value;
        }
        );
    }, 15);

/**
 * Create the custom tables
 */
function crm_create_custom_tables()
{
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    // Activity Logs Table
    $table_logs = $wpdb->prefix . 'crm_activity_logs';
    $sql_logs = "CREATE TABLE IF NOT EXISTS $table_logs (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20) NOT NULL,
        username varchar(60) NOT NULL,
        action varchar(100) NOT NULL,
        details text NOT NULL,
        ip_address varchar(45) NOT NULL,
        timestamp datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (id),
        KEY user_id (user_id),
        KEY action (action)
    ) $charset_collate;";

    // Leads Table
    $table_leads = $wpdb->prefix . 'leads';
    $sql_leads = "CREATE TABLE IF NOT EXISTS $table_leads (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        phone VARCHAR(50),
        company VARCHAR(191),
        description TEXT,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        assigned_to BIGINT UNSIGNED,
        follow_up_date DATETIME,
        follow_up_status VARCHAR(50) DEFAULT 'pending',
        follow_up_type VARCHAR(50) DEFAULT 'call',
        source VARCHAR(50),
        campaign VARCHAR(191),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY email (email),
        KEY status (status)
    ) $charset_collate;";
    // Notifications Table
    $table_notifications = $wpdb->prefix . 'crm_notifications';
    $sql_notifications = "CREATE TABLE IF NOT EXISTS $table_notifications (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id VARCHAR(100) NOT NULL,
        role_target VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        action_type VARCHAR(100),
        resource_type VARCHAR(100),
        resource_id VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id (user_id)
    ) $charset_collate;";

    // Per-user read tracking (replaces is_read on notification row)
    $table_reads = $wpdb->prefix . 'crm_notification_reads';
    $sql_reads = "CREATE TABLE IF NOT EXISTS $table_reads (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        notification_id bigint(20) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_read (notification_id, user_id),
        KEY user_id (user_id)
    ) $charset_collate;";

    // Per-user dismissals — for clearing broadcast notifications per user
    $table_dismissals = $wpdb->prefix . 'crm_notification_dismissals';
    $sql_dismissals = "CREATE TABLE IF NOT EXISTS $table_dismissals (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        notification_id bigint(20) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        dismissed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_dismiss (notification_id, user_id),
        KEY user_id (user_id)
    ) $charset_collate;";

    // SEO Meta Tags Table
    $table_seo_meta = $wpdb->prefix . 'crm_seo_meta';
    $sql_seo_meta = "CREATE TABLE IF NOT EXISTS $table_seo_meta (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        page_identifier varchar(255) NOT NULL,
        post_id varchar(100),
        rest_base varchar(100),
        title varchar(255),
        keywords text,
        description text,
        assigned_to varchar(100),
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY assigned_to (assigned_to)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql_logs);
    dbDelta($sql_leads);
    dbDelta($sql_notifications);
    dbDelta($sql_reads);
    dbDelta($sql_dismissals);
    dbDelta($sql_seo_meta);
}

register_activation_hook(__FILE__, 'crm_create_custom_tables');
add_action('init', 'crm_create_custom_tables');

/**
 * CRM API Key Security
 */
function crm_get_api_key()
{
    return defined('CRM_API_KEY') ? CRM_API_KEY : 'SECRET123';
}

function crm_check_api_key($request)
{
    $provided_key = $request->get_param('api_key');
    if (!$provided_key) {
        $header = $request->get_header('x-crm-api-key');
        if ($header)
            $provided_key = $header;
    }

    if ($provided_key === crm_get_api_key()) {
        return true;
    }

    // Also allow logged in admins as a fallback for the Admin UI itself
    if (current_user_can('manage_options')) {
        return true;
    }

    return new WP_Error('rest_forbidden', 'Invalid API Key', ['status' => 401]);
}

/**
 * Register REST API Routes
 */
add_action('rest_api_init', function () {
    // Activity Logs
    register_rest_route('crm/v1', '/log', array(
        'methods' => 'POST',
        'callback' => 'crm_handle_log_activity',
        'permission_callback' => 'crm_check_api_key'
    ));

    register_rest_route('crm/v1', '/logs', array(
        'methods' => 'GET',
        'callback' => 'crm_get_activity_logs',
        'permission_callback' => 'crm_check_api_key'
    ));

    // Users (Custom Unified Endpoint)
    register_rest_route('crm/v1', '/users', array(
        'methods' => 'GET',
        'callback' => 'crm_get_unified_users',
        'permission_callback' => 'crm_check_api_key'
    ));

    // Leads
    register_rest_route('crm/v1', '/leads', [
        [
            'methods' => 'GET',
            'callback' => 'crm_get_all_leads',
            'permission_callback' => 'crm_check_api_key'
        ],
        [
            'methods' => 'POST',
            'callback' => 'save_crm_lead',
            'permission_callback' => 'crm_check_api_key'
        ]
    ]);

    // Compatible alias for singular lead create
    register_rest_route('crm/v1', '/lead', [
        'methods' => 'POST',
        'callback' => 'save_crm_lead',
        'permission_callback' => 'crm_check_api_key'
    ]);

    register_rest_route('crm/v1', '/leads/(?P<id>\d+)', [
        [
            'methods' => 'GET',
            'callback' => 'crm_get_single_lead',
            'permission_callback' => 'crm_check_api_key'
        ],
        [
            'methods' => 'POST',
            'callback' => 'update_crm_lead',
            'permission_callback' => 'crm_check_api_key'
        ],
        [
            'methods' => 'DELETE',
            'callback' => 'crm_delete_lead',
            'permission_callback' => 'crm_check_api_key'
        ]
    ]);

    // Also support /lead/{id} if frontend uses it
    register_rest_route('crm/v1', '/lead/(?P<id>\d+)', [
        'methods' => 'POST',
        'callback' => 'update_crm_lead',
        'permission_callback' => 'crm_check_api_key'
    ]);

    // Notifications
    register_rest_route('crm/v1', '/notifications', array(
        [
            'methods' => 'GET',
            'callback' => 'crm_get_notifications',
            'permission_callback' => 'crm_check_api_key'
        ],
        [
            'methods' => 'POST',
            'callback' => 'crm_create_notification',
            'permission_callback' => 'crm_check_api_key'
        ]
    ));

    // Mark a single notification as read for a specific user
    register_rest_route('crm/v1', '/notifications/(?P<id>\d+)/read', array(
        'methods' => 'POST, PATCH',
        'callback' => 'crm_mark_notification_read',
        'permission_callback' => 'crm_check_api_key'
    ));

    // Mark ALL notifications as read for the requesting user
    register_rest_route('crm/v1', '/notifications/read-all', array(
        'methods' => 'POST',
        'callback' => 'crm_mark_all_notifications_read',
        'permission_callback' => 'crm_check_api_key'
    ));

    // Clear (dismiss) ALL notifications for the requesting user
    register_rest_route('crm/v1', '/notifications/clear', array(
        'methods' => 'POST',
        'callback' => 'crm_clear_notifications',
        'permission_callback' => 'crm_check_api_key'
    ));

    // Delete a single notification row (admin only)
    register_rest_route('crm/v1', '/notifications/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'crm_delete_notification',
        'permission_callback' => 'crm_check_api_key'
    ));

    // SEO Meta Tags
    register_rest_route('crm/v1', '/seo-meta', [
        [
            'methods' => 'GET',
            'callback' => 'crm_get_all_seo_meta',
            'permission_callback' => 'crm_check_api_key'
        ],
        [
            'methods' => 'POST',
            'callback' => 'crm_create_seo_meta',
            'permission_callback' => 'crm_check_api_key'
        ]
    ]);

    register_rest_route('crm/v1', '/seo-meta/(?P<id>\d+)', [
        [
            'methods' => 'POST',
            'callback' => 'crm_update_seo_meta',
            'permission_callback' => 'crm_check_api_key'
        ],
        [
            'methods' => 'DELETE',
            'callback' => 'crm_delete_seo_meta',
            'permission_callback' => 'crm_check_api_key'
        ]
    ]);
});

/**
 * Get unified users list
 */
function crm_get_unified_users()
{
    $users = get_users(['fields' => ['ID', 'display_name', 'user_email', 'user_login']]);
    $results = [];

    foreach ($users as $user) {
        $wp_user = get_userdata($user->ID);
        $role = 'client';
        if (in_array('administrator', $wp_user->roles))
            $role = 'admin';
        else if (in_array('editor', $wp_user->roles) || in_array('seo_manager', $wp_user->roles))
            $role = 'seo';
        else if (in_array('author', $wp_user->roles) || in_array('contributor', $wp_user->roles))
            $role = 'sales';

        $results[] = [
            'id' => strval($user->ID),
            'username' => $user->display_name ?: $user->user_login,
            'email' => $user->user_email,
            'role' => $role
        ];
    }

    return rest_ensure_response($results);
}

/**
 * Handle logging request
 */
function crm_handle_log_activity($request)
{
    global $wpdb;
    $table_logs = $wpdb->prefix . 'crm_activity_logs';
    $table_leads = $wpdb->prefix . 'leads';
    $table_notifications = $wpdb->prefix . 'crm_notifications';
    $params = $request->get_json_params();

    // Attempt to get user via WP session
    $user_id = get_current_user_id();
    $user = wp_get_current_user();

    $username = $user->exists() ? $user->user_login : 'anonymous';

    // When authenticated via API key, get_current_user_id() returns 0 (no WP session).
    // Use user_id / username passed in the request body as a fallback.
    if (!$user_id && is_array($params)) {
        // Step 1: set user_id from body if provided
        if (!empty($params['user_id']) && intval($params['user_id']) > 0) {
            $user_id = intval($params['user_id']);
            // Try to resolve the official WP login name from DB
            $wp_user_data = get_userdata($user_id);
            if ($wp_user_data) {
                $username = $wp_user_data->user_login;
            }
        }
        // Step 2: if username is still 'anonymous', use whatever the client sent
        if ($username === 'anonymous' && !empty($params['username'])) {
            $username = sanitize_text_field($params['username']);
        }
    }

    $action = isset($params['action']) ? sanitize_text_field($params['action']) : 'unknown';
    $details = isset($params['details']) ? sanitize_textarea_field(is_string($params['details']) ? $params['details'] : json_encode($params['details'])) : '';
    $ip = $_SERVER['REMOTE_ADDR'];

    $result = $wpdb->insert(
        $table_logs,
        array(
        'user_id' => $user_id,
        'username' => $username,
        'action' => $action,
        'details' => $details,
        'ip_address' => $ip,
        'timestamp' => current_time('mysql'),
    )
    );

    if ($result) {
        return new WP_REST_Response(array('success' => true, 'message' => 'Log saved'), 200);
    }
    else {
        error_log("CRM Log Insert Failure: " . $wpdb->last_error);
        return new WP_Error('db_error', 'Could not save log: ' . $wpdb->last_error, array('status' => 500));
    }
}

/**
 * Get activity logs
 */
function crm_get_activity_logs($request)
{
    global $wpdb;
    $table_logs = $wpdb->prefix . 'crm_activity_logs';

    // Verify table exists
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_logs'") != $table_logs) {
        return new WP_Error('db_error', 'Table ' . $table_logs . ' does not exist.', array('status' => 500));
    }

    $per_page = 50;
    $page = $request->get_param('page') ? intval($request->get_param('page')) : 1;
    $offset = ($page - 1) * $per_page;

    $results = $wpdb->get_results(
        $wpdb->prepare(
        "SELECT * FROM $table_logs ORDER BY timestamp DESC LIMIT %d OFFSET %d",
        $per_page,
        $offset
    )
    );

    if ($wpdb->last_error) {
        return new WP_Error('db_error', 'Query error: ' . $wpdb->last_error, array('status' => 500));
    }

    return new WP_REST_Response($results, 200);
}

// Admin UI Stuff
add_action('admin_enqueue_scripts', function () {
    wp_enqueue_style('crm-css', get_template_directory_uri() . '/assets/css/crm.css');
});

add_action('init', function () {
    register_post_type('crm_lead', [
        'label' => 'CRM Leads',
        'public' => false,
        'show_ui' => false,
        'supports' => ['title'],
    ]);
});

add_action('admin_menu', function () {
    add_menu_page('CRM', 'CRM', 'read', 'crm-dashboard', 'crm_dashboard', 'dashicons-chart-bar', 3);
    add_submenu_page('crm-dashboard', 'Leads', 'Leads', 'read', 'crm-leads', 'crm_leads');
    add_submenu_page('crm-dashboard', 'Follow-ups', 'Follow-ups', 'read', 'crm-followups', 'crm_followups');
    add_submenu_page('crm-dashboard', 'Export', 'Export', 'read', 'crm-export', 'crm_export');
});

function crm_dashboard()
{
    include get_template_directory() . '/crm/dashboard.php';
}
function crm_leads()
{
    include get_template_directory() . '/crm/leads.php';
}
function crm_followups()
{
    include get_template_directory() . '/crm/followups.php';
}
function crm_export()
{
    include get_template_directory() . '/crm/export.php';
}

/**
 * LEADS LOGIC
 */
function save_crm_lead($request)
{
    global $wpdb;
    $table_leads = $wpdb->prefix . 'leads';

    $data = $request->get_json_params();

    // basic validation
    if (empty($data['email'])) {
        return new WP_Error('missing_field', 'Email required', ['status' => 400]);
    }

    // prevent duplicate
    $exists = $wpdb->get_var(
        $wpdb->prepare("SELECT id FROM $table_leads WHERE email = %s", $data['email'])
    );
    if ($exists) {
        return [
            'status' => 'duplicate',
            'message' => 'A lead with this email already exists'
        ];
    }

    $wpdb->insert($table_leads, [
        'name' => sanitize_text_field($data['name'] ?? ''),
        'email' => sanitize_email($data['email']),
        'phone' => sanitize_text_field($data['phone'] ?? ''),
        'company' => sanitize_text_field($data['company'] ?? ''),
        'description' => sanitize_textarea_field($data['description'] ?? $data['message'] ?? ''),
        'notes' => sanitize_textarea_field($data['notes'] ?? ''),
        'source' => sanitize_text_field($data['source'] ?? 'website'),
        'campaign' => sanitize_text_field($data['campaign'] ?? ''),
        'status' => sanitize_text_field($data['status'] ?? 'pending'),
        'assigned_to' => sanitize_text_field($data['assigned_to'] ?? ''),
    ]);

    return [
        'status' => 'success',
        'lead_id' => $wpdb->insert_id
    ];
}

function update_crm_lead($request)
{
    global $wpdb;
    $table_leads = $wpdb->prefix . 'leads';
    $id = intval($request['id']);
    $data = $request->get_json_params();

    if (!$id) {
        return new WP_Error('invalid_id', 'Lead ID required', ['status' => 400]);
    }

    $fields = [];
    if (isset($data['name']))
        $fields['name'] = sanitize_text_field($data['name']);
    if (isset($data['email']))
        $fields['email'] = sanitize_email($data['email']);
    if (isset($data['phone']))
        $fields['phone'] = sanitize_text_field($data['phone']);
    if (isset($data['company']))
        $fields['company'] = sanitize_text_field($data['company']);
    if (isset($data['description']))
        $fields['description'] = sanitize_textarea_field($data['description']);
    if (isset($data['status']))
        $fields['status'] = sanitize_text_field($data['status']);
    if (isset($data['source']))
        $fields['source'] = sanitize_text_field($data['source']);
    if (isset($data['notes']))
        $fields['notes'] = sanitize_textarea_field($data['notes']);
    if (isset($data['follow_up_date']))
        $fields['follow_up_date'] = sanitize_text_field($data['follow_up_date']);
    if (isset($data['follow_up_status']))
        $fields['follow_up_status'] = sanitize_text_field($data['follow_up_status']);
    if (isset($data['follow_up_type']))
        $fields['follow_up_type'] = sanitize_text_field($data['follow_up_type']);
    if (isset($data['assigned_to']))
        $fields['assigned_to'] = sanitize_text_field($data['assigned_to']);

    if (empty($fields)) {
        return ['status' => 'no_changes', 'message' => 'No fields provided for update'];
    }

    $result = $wpdb->update($table_leads, $fields, ['id' => $id]);

    if ($result === false) {
        return new WP_Error('db_error', 'Failed to update lead: ' . $wpdb->last_error, ['status' => 500]);
    }

    return [
        'status' => 'success',
        'updated_fields' => array_keys($fields)
    ];
}

function crm_delete_lead($request)
{
    global $wpdb;
    $table_leads = $wpdb->prefix . 'leads';
    $id = intval($request['id']);
    $wpdb->delete($table_leads, ['id' => $id]);
    return ['status' => 'success'];
}

function crm_get_single_lead($request)
{
    global $wpdb;
    $table_leads = $wpdb->prefix . 'leads';
    $id = intval($request['id']);

    $lead = $wpdb->get_row(
        $wpdb->prepare("SELECT * FROM $table_leads WHERE id = %d", $id),
        ARRAY_A
    );

    if (!$lead) {
        return new WP_Error('not_found', 'Lead not found ' . $id, ['status' => 404]);
    }

    return rest_ensure_response($lead);
}

function crm_get_all_leads()
{
    global $wpdb;
    $table_leads = $wpdb->prefix . 'leads';

    $leads = $wpdb->get_results(
        "SELECT * FROM $table_leads ORDER BY id DESC",
        ARRAY_A
    );

    return rest_ensure_response($leads);
}

/**
 * NOTIFICATIONS LOGIC
 * Read state is tracked per-user in crm_notification_reads.
 * Dismissals (clear) are tracked per-user in crm_notification_dismissals.
 */
function crm_get_notifications($request)
{
    global $wpdb;
    $tn = $wpdb->prefix . 'crm_notifications';
    $tr = $wpdb->prefix . 'crm_notification_reads';
    $td = $wpdb->prefix . 'crm_notification_dismissals';

    $userId = sanitize_text_field($request->get_param('userId'));
    $isSuperAdmin = $request->get_param('isSuperAdmin') === 'true';
    $userRole = sanitize_text_field($request->get_param('userRole') ?? '');

    if ($isSuperAdmin) {
        // Super admin: all notifications, with per-user read state
        $results = $wpdb->get_results(
            $wpdb->prepare(
            "SELECT n.*,
                        IF(r.id IS NOT NULL, 1, 0) AS is_read
                 FROM $tn n
                 LEFT JOIN $tr r ON r.notification_id = n.id AND r.user_id = %s
                 LEFT JOIN $td d ON d.notification_id = n.id AND d.user_id = %s
                 WHERE d.id IS NULL
                 ORDER BY n.created_at DESC
                 LIMIT 100",
            $userId,
            $userId
        ),
            ARRAY_A
        );
    }
    elseif ($userRole === 'admin') {
        // Admin: own notifications + admin role broadcasts
        $results = $wpdb->get_results(
            $wpdb->prepare(
            "SELECT n.*,
                        IF(r.id IS NOT NULL, 1, 0) AS is_read
                 FROM $tn n
                 LEFT JOIN $tr r ON r.notification_id = n.id AND r.user_id = %s
                 LEFT JOIN $td d ON d.notification_id = n.id AND d.user_id = %s
                 WHERE d.id IS NULL
                   AND (
                       (n.user_id = %s AND (n.role_target IS NULL OR n.role_target = ''))
                       OR n.role_target = 'admin'
                   )
                 ORDER BY n.created_at DESC
                 LIMIT 100",
            $userId,
            $userId,
            $userId
        ),
            ARRAY_A
        );
    }
    else {
        // Regular user: ONLY notifications directly assigned to them
        $results = $wpdb->get_results(
            $wpdb->prepare(
            "SELECT n.*,
                        IF(r.id IS NOT NULL, 1, 0) AS is_read
                 FROM $tn n
                 LEFT JOIN $tr r ON r.notification_id = n.id AND r.user_id = %s
                 LEFT JOIN $td d ON d.notification_id = n.id AND d.user_id = %s
                 WHERE d.id IS NULL
                   AND n.user_id = %s
                 ORDER BY n.created_at DESC
                 LIMIT 100",
            $userId,
            $userId,
            $userId
        ),
            ARRAY_A
        );
    }

    return rest_ensure_response($results);
}

function crm_create_notification($request)
{
    global $wpdb;
    $table_notifications = $wpdb->prefix . 'crm_notifications';
    $data = $request->get_json_params();

    $wpdb->insert($table_notifications, [
        'user_id' => sanitize_text_field($data['user_id'] ?? ''),
        'role_target' => sanitize_text_field($data['role_target'] ?? ''),
        'title' => sanitize_text_field($data['title'] ?? ''),
        'message' => sanitize_textarea_field($data['message'] ?? ''),
        'type' => sanitize_text_field($data['type'] ?? 'info'),
        'action_type' => sanitize_text_field($data['action_type'] ?? ''),
        'resource_type' => sanitize_text_field($data['resource_type'] ?? ''),
        'resource_id' => sanitize_text_field($data['resource_id'] ?? ''),
    ]);

    return [
        'status' => 'success',
        'id' => $wpdb->insert_id
    ];
}

/**
 * Mark a single notification as read FOR THE REQUESTING USER only.
 * Body: { "userId": "123" }
 * Also accepts userId from URL query param for compatibility.
 */
function crm_mark_notification_read($request)
{
    global $wpdb;
    $table_reads = $wpdb->prefix . 'crm_notification_reads';
    $id = intval($request['id']);
    $data = $request->get_json_params();
    $userId = sanitize_text_field(
        $data['userId'] ?? $request->get_param('userId') ?? ''
    );

    if ($userId) {
        // INSERT IGNORE: silently skip if already read by this user
        $wpdb->query(
            $wpdb->prepare(
            "INSERT IGNORE INTO $table_reads (notification_id, user_id) VALUES (%d, %s)",
            $id, $userId
        )
        );
    }

    return ['status' => 'success'];
}

/**
 * Mark ALL visible notifications as read for the requesting user.
 * Body: { "userId": "123", "isSuperAdmin": true|false }
 */
function crm_mark_all_notifications_read($request)
{
    global $wpdb;
    $tn = $wpdb->prefix . 'crm_notifications';
    $tr = $wpdb->prefix . 'crm_notification_reads';
    $data = $request->get_json_params();
    $userId = sanitize_text_field($data['userId'] ?? '');
    $isSuperAdmin = !empty($data['isSuperAdmin']);

    if (!$userId)
        return ['status' => 'error', 'message' => 'userId required'];

    if ($isSuperAdmin) {
        $notifIds = $wpdb->get_col("SELECT id FROM $tn");
    }
    else {
        $notifIds = $wpdb->get_col(
            $wpdb->prepare(
            "SELECT id FROM $tn
                 WHERE (user_id = %s AND (role_target IS NULL OR role_target = ''))
                    OR role_target = 'admin'",
            $userId
        )
        );
    }

    foreach ($notifIds as $nid) {
        $wpdb->query(
            $wpdb->prepare(
            "INSERT IGNORE INTO $tr (notification_id, user_id) VALUES (%d, %s)",
            intval($nid), $userId
        )
        );
    }

    return ['status' => 'success'];
}

/**
 * Clear (dismiss) all notifications for the requesting user.
 * Body: { "userId": "123", "isSuperAdmin": true|false }
 * - User-specific notifications are deleted from the main table.
 * - Broadcast (role_target='admin') notifications are dismissed per-user via dismissals table.
 */
function crm_clear_notifications($request)
{
    global $wpdb;
    $tn = $wpdb->prefix . 'crm_notifications';
    $td = $wpdb->prefix . 'crm_notification_dismissals';
    $data = $request->get_json_params();
    $userId = sanitize_text_field($data['userId'] ?? '');
    $userRole = sanitize_text_field($data['userRole'] ?? '');
    $isSuperAdmin = !empty($data['isSuperAdmin']);

    if (!$userId)
        return ['status' => 'error', 'message' => 'userId required'];

    // Instead of deleting, we find all notifications the user currently sees and DISMISS them.
    // This preserves the data for other users.
    $query = "SELECT id FROM $tn ";
    if ($isSuperAdmin) {
        // Super admin sees everything
        $notifIds = $wpdb->get_col($query);
    }
    elseif ($userRole === 'admin') {
        // Admin sees own + admin broadcasts
        $notifIds = $wpdb->get_col($wpdb->prepare(
            "$query WHERE (user_id = %s AND (role_target IS NULL OR role_target = '')) OR role_target = 'admin'",
            $userId
        ));
    }
    else {
        // Regular user sees only their assignments
        $notifIds = $wpdb->get_col($wpdb->prepare(
            "$query WHERE user_id = %s",
            $userId
        ));
    }

    if (!empty($notifIds)) {
        foreach ($notifIds as $nid) {
            $wpdb->query($wpdb->prepare(
                "INSERT IGNORE INTO $td (notification_id, user_id) VALUES (%d, %s)",
                intval($nid), $userId
            ));
        }
    }

    return ['status' => 'success'];
}

function crm_delete_notification($request)
{
    global $wpdb;
    $td = $wpdb->prefix . 'crm_notification_dismissals';
    $id = intval($request['id']);
    $data = $request->get_json_params();
    $userId = sanitize_text_field($data['userId'] ?? '');

    if (!$userId) {
        // Fallback for safety, though frontend should always pass it now
        return ['status' => 'error', 'message' => 'userId required for per-user delete'];
    }

    // Instead of actual DELETE, we just DISMISS it for this user
    $wpdb->query($wpdb->prepare(
        "INSERT IGNORE INTO $td (notification_id, user_id) VALUES (%d, %s)",
        $id, $userId
    ));

    return ['status' => 'success'];
}

/**
 * IP Whitelist Endpoints
 */
add_action('rest_api_init', function () {
    register_rest_route('crm/v1', '/ip-whitelist', [
        [
            'methods' => 'GET',
            'callback' => 'crm_get_ip_whitelist',
            'permission_callback' => 'crm_ip_is_authenticated',
        ],
        [
            'methods' => 'POST',
            'callback' => 'crm_add_ip_whitelist',
            'permission_callback' => 'crm_ip_is_admin',
        ],
    ]);

    register_rest_route('crm/v1', '/ip-whitelist/(?P<id>[a-z0-9]+)', [
        [
            'methods' => 'DELETE',
            'callback' => 'crm_delete_ip_whitelist',
            'permission_callback' => 'crm_ip_is_admin',
        ],
    ]);
});

function crm_get_ip_whitelist()
{
    $whitelist = get_option('crm_ip_whitelist', []);
    return rest_ensure_response(array_values($whitelist));
}

function crm_add_ip_whitelist(WP_REST_Request $request)
{
    $entry = $request->get_json_params();

    if (empty($entry['ip']) || empty($entry['userId'])) {
        return new WP_Error('missing_fields', 'ip and userId are required', ['status' => 400]);
    }

    $whitelist = get_option('crm_ip_whitelist', []);
    $whitelist[] = $entry;
    update_option('crm_ip_whitelist', $whitelist);

    return rest_ensure_response($entry);
}

function crm_delete_ip_whitelist(WP_REST_Request $request)
{
    $id = $request->get_param('id');
    $whitelist = get_option('crm_ip_whitelist', []);
    $whitelist = array_values(array_filter($whitelist, fn($e) => $e['id'] !== $id));
    update_option('crm_ip_whitelist', $whitelist);

    return rest_ensure_response(['deleted' => true, 'id' => $id]);
}

function crm_ip_is_authenticated()
{
    return get_current_user_id() > 0;
}

function crm_ip_is_admin()
{
    return current_user_can('administrator');
}

/**
 * SEO META TAGS LOGIC
 */
function crm_get_all_seo_meta()
{
    global $wpdb;
    $table = $wpdb->prefix . 'crm_seo_meta';

    $rows = $wpdb->get_results(
        "SELECT * FROM $table ORDER BY id DESC",
        ARRAY_A
    );

    return rest_ensure_response($rows ?: []);
}

function crm_create_seo_meta($request)
{
    global $wpdb;
    $table = $wpdb->prefix . 'crm_seo_meta';
    $data = $request->get_json_params();

    if (empty($data['page_identifier'])) {
        return new WP_Error('missing_field', 'page_identifier required', ['status' => 400]);
    }

    $wpdb->insert($table, [
        'page_identifier' => sanitize_text_field($data['page_identifier']),
        'post_id'         => sanitize_text_field($data['post_id'] ?? ''),
        'rest_base'       => sanitize_text_field($data['rest_base'] ?? ''),
        'title'           => sanitize_text_field($data['title'] ?? ''),
        'keywords'        => sanitize_textarea_field($data['keywords'] ?? ''),
        'description'     => sanitize_textarea_field($data['description'] ?? ''),
        'assigned_to'     => sanitize_text_field($data['assigned_to'] ?? ''),
    ]);

    return rest_ensure_response([
        'id'              => $wpdb->insert_id,
        'page_identifier' => $data['page_identifier'],
        'post_id'         => $data['post_id'] ?? '',
        'rest_base'       => $data['rest_base'] ?? '',
        'title'           => $data['title'] ?? '',
        'keywords'        => $data['keywords'] ?? '',
        'description'     => $data['description'] ?? '',
        'assigned_to'     => $data['assigned_to'] ?? '',
        'created_at'      => current_time('mysql'),
        'updated_at'      => current_time('mysql'),
    ]);
}

function crm_update_seo_meta($request)
{
    global $wpdb;
    $table = $wpdb->prefix . 'crm_seo_meta';
    $id = intval($request['id']);
    $data = $request->get_json_params();

    if (!$id) {
        return new WP_Error('invalid_id', 'SEO meta tag ID required', ['status' => 400]);
    }

    $fields = [];
    if (isset($data['page_identifier'])) $fields['page_identifier'] = sanitize_text_field($data['page_identifier']);
    if (isset($data['post_id']))         $fields['post_id']         = sanitize_text_field($data['post_id']);
    if (isset($data['rest_base']))       $fields['rest_base']       = sanitize_text_field($data['rest_base']);
    if (isset($data['title']))           $fields['title']           = sanitize_text_field($data['title']);
    if (isset($data['keywords']))        $fields['keywords']        = sanitize_textarea_field($data['keywords']);
    if (isset($data['description']))     $fields['description']     = sanitize_textarea_field($data['description']);
    if (isset($data['assigned_to']))     $fields['assigned_to']     = sanitize_text_field($data['assigned_to']);

    if (empty($fields)) {
        return ['status' => 'no_changes'];
    }

    $wpdb->update($table, $fields, ['id' => $id]);

    return rest_ensure_response(['status' => 'success', 'id' => $id]);
}

function crm_delete_seo_meta($request)
{
    global $wpdb;
    $table = $wpdb->prefix . 'crm_seo_meta';
    $id = intval($request['id']);
    $wpdb->delete($table, ['id' => $id]);
    return rest_ensure_response(['status' => 'success']);
}
