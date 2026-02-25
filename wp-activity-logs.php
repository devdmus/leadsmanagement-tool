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
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE");
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
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT');
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
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id (user_id),
        KEY is_read (is_read)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql_logs);
    dbDelta($sql_leads);
    dbDelta($sql_notifications);
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

    register_rest_route('crm/v1', '/notifications/(?P<id>\d+)/read', array(
        'methods' => 'PATCH',
        'callback' => 'crm_mark_notification_read',
        'permission_callback' => 'crm_check_api_key'
    ));

    register_rest_route('crm/v1', '/notifications/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'crm_delete_notification',
        'permission_callback' => 'crm_check_api_key'
    ));
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

    // Attempt to get user
    $user_id = get_current_user_id();
    $user = wp_get_current_user();

    $username = $user->exists() ? $user->user_login : 'anonymous';
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
 */
function crm_get_notifications($request)
{
    global $wpdb;
    $table_notifications = $wpdb->prefix . 'crm_notifications';

    $userId = $request->get_param('userId');
    $isSuperAdmin = $request->get_param('isSuperAdmin') === 'true';

    if ($isSuperAdmin) {
        $results = $wpdb->get_results("SELECT * FROM $table_notifications ORDER BY created_at DESC LIMIT 50", ARRAY_A);
    }
    else {
        $results = $wpdb->get_results(
            $wpdb->prepare(
            "SELECT * FROM $table_notifications WHERE user_id = %s OR role_target = 'admin' ORDER BY created_at DESC LIMIT 50",
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

function crm_mark_notification_read($request)
{
    global $wpdb;
    $table_notifications = $wpdb->prefix . 'crm_notifications';
    $id = intval($request['id']);

    $wpdb->update($table_notifications, ['is_read' => 1], ['id' => $id]);
    return ['status' => 'success'];
}

function crm_delete_notification($request)
{
    global $wpdb;
    $table_notifications = $wpdb->prefix . 'crm_notifications';
    $id = intval($request['id']);

    $wpdb->delete($table_notifications, ['id' => $id]);
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
