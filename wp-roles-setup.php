<?php
/**
 * Copy this code into your WordPress theme's functions.php file
 * OR save it as a new file in wp-content/plugins/crm-roles.php and activate it.
 */

/* function crm_add_custom_roles() {
 $roles = [
 'sales_manager' => [
 'display_name' => 'Sales Manager',
 'caps' => [
 'read' => true,
 'edit_posts' => true,
 'delete_posts' => true,
 'upload_files' => true,
 'list_users' => true, // Required for CRM user list
 ]
 ],
 'sales_person' => [
 'display_name' => 'Sales Person',
 'caps' => [
 'read' => true,
 'edit_posts' => true,
 'delete_posts' => false,
 'list_users' => true, // Allow seeing teammates
 ]
 ],
 'seo_manager' => [
 'display_name' => 'SEO Manager',
 'caps' => [
 'read' => true,
 'edit_posts' => true,
 'edit_others_posts' => true,
 'publish_posts' => true,
 'manage_categories' => true,
 'list_users' => true, // Required for CRM user list
 ]
 ],
 'seo_person' => [
 'display_name' => 'SEO Person',
 'caps' => [
 'read' => true,
 'edit_posts' => true,
 'list_users' => true, // Allow seeing teammates
 ]
 ]
 ];
 foreach ($roles as $role_slug => $role_data) {
 $role = get_role($role_slug);
 if (!$role) {
 add_role($role_slug, $role_data['display_name'], $role_data['caps']);
 }
 else {
 foreach ($role_data['caps'] as $cap => $grant) {
 if ($grant) {
 $role->add_cap($cap);
 }
 else {
 $role->remove_cap($cap);
 }
 }
 }
 } }
 
// Hook into the 'init' action add_action('init', 'crm_add_custom_roles'); */
