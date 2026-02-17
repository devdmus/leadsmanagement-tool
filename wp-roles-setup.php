<?php
/**
 * Copy this code into your WordPress theme's functions.php file
 * OR save it as a new file in wp-content/plugins/crm-roles.php and activate it.
 */

function crm_add_custom_roles() {
    // 1. Sales Manager (Full Leads access)
    // Based on 'author' capabilities (can publish/edit own posts)
    add_role(
        'sales_manager',
        'Sales Manager',
        array(
            'read'         => true,  // True allows that capability
            'edit_posts'   => true,
            'delete_posts' => true, // Use false to explicitly deny
            'upload_files' => true,
        )
    );

    // 2. Sales Person (Assigned Leads access)
    // Based on 'contributor' (can write but needs approval)
    add_role(
        'sales_person',
        'Sales Person',
        array(
            'read'       => true,
            'edit_posts' => true,
            'delete_posts' => false,
        )
    );

    // 3. SEO Manager (Full SEO/Blog access)
    // Based on 'editor' (can edit others' posts)
    add_role(
        'seo_manager',
        'SEO Manager',
        array(
            'read'              => true,
            'edit_posts'        => true,
            'edit_others_posts' => true,
            'publish_posts'     => true,
            'manage_categories' => true,
        )
    );

    // 4. SEO Person (Assigned SEO access)
    // Based on 'contributor' logic
    add_role(
        'seo_person',
        'SEO Person',
        array(
            'read'       => true,
            'edit_posts' => true,
        )
    );
}

// Hook into the 'init' action
add_action('init', 'crm_add_custom_roles');
