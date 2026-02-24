<?php
/**
 * Plugin Name: CRM Activity Logs
 * Description: Custom table and REST API for CRM activity logging.
 * Version: 1.3
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
    header("Access-Control-Allow-Headers: Authorization, Content-Type");
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        status_header(200);
        exit;
    }
});

/**
 * Create the custom table
 */
function crm_create_activity_logs_table()
{
    global $wpdb;
    $table_name = $wpdb->prefix . 'crm_activity_logs';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
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

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

register_activation_hook(__FILE__, 'crm_create_activity_logs_table');
add_action('init', 'crm_create_activity_logs_table');

/**
 * Register REST API Routes
 */
add_action('rest_api_init', function () {
    register_rest_route('crm/v1', '/log', array(
        'methods' => 'POST',
        'callback' => 'crm_handle_log_activity',
        'permission_callback' => '__return_true'
    ));

    register_rest_route('crm/v1', '/logs', array(
        'methods' => 'GET',
        'callback' => 'crm_get_activity_logs',
        'permission_callback' => function () {
            return current_user_can('administrator') || current_user_can('manage_options') || crm_manual_auth_check();
        }
        ));    });

/**
 * Manual Auth Check for GET requests
 */
function crm_manual_auth_check()
{
    $user = crm_get_authenticated_user();
    if ($user && ($user->has_cap('administrator') || $user->has_cap('manage_options'))) {
        wp_set_current_user($user->ID);
        return true;
    }
    return false;
}

/**
 * Helper to get user from Authorization header
 */
function crm_get_authenticated_user()
{
    $auth_header = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : '');

    if (empty($auth_header) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $auth_header = $headers['Authorization'];
        }
    }

    if (strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        if (strpos($credentials, ':') !== false) {
            list($username, $password) = explode(':', $credentials, 2);
            $user = wp_authenticate($username, $password);
            if (!is_wp_error($user)) {
                return $user;
            }
        }
    }
    return null;
}

/**
 * Handle logging request
 */
function crm_handle_log_activity($request)
{
    global $wpdb;
    $table_name = $wpdb->prefix . 'crm_activity_logs';

    $params = $request->get_json_params();

    // Attempt to get user Normally
    $user_id = get_current_user_id();
    $user = wp_get_current_user();

    // Fallback to manual auth if anonymous
    if (!$user->exists()) {
        $manual_user = crm_get_authenticated_user();
        if ($manual_user) {
            $user_id = $manual_user->ID;
            $user = $manual_user;
        }
    }

    $username = $user->exists() ? $user->user_login : 'anonymous';
    $action = isset($params['action']) ? sanitize_text_field($params['action']) : 'unknown';
    $details = isset($params['details']) ? sanitize_textarea_field($params['details']) : '';
    $ip = $_SERVER['REMOTE_ADDR'];

    $result = $wpdb->insert(
        $table_name,
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
        return new WP_REST_Response(array('success' => true, 'message' => 'Log saved', 'user' => $username, 'user_id' => $user_id), 200);
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
    $table_name = $wpdb->prefix . 'crm_activity_logs';

    // Verify table exists
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
        return new WP_Error('db_error', 'Table ' . $table_name . ' does not exist. Please re-run the activation snippet.', array('status' => 500));
    }

    $per_page = 50;
    $page = $request->get_param('page') ? intval($request->get_param('page')) : 1;
    $offset = ($page - 1) * $per_page;

    $results = $wpdb->get_results(
        $wpdb->prepare(
        "SELECT * FROM $table_name ORDER BY timestamp DESC LIMIT %d OFFSET %d",
        $per_page,
        $offset
    )
    );

    if ($wpdb->last_error) {
        return new WP_Error('db_error', 'Query error: ' . $wpdb->last_error, array('status' => 500));
    }

    return new WP_REST_Response($results, 200);
}
