<?php

/**
 * Plugin Name: GF Merge Tag Autocomplete
 * Plugin URI:  https://github.com/guilamu/gf-merge-tag-autocomplete
 * Description: Type { in any Gravity Forms merge-tag-enabled field to instantly search and insert merge tags — no more clicking the {..} button.
 * Version:     1.0.0
 * Author:      Guilamu
 * Author URI:  https://github.com/guilamu
 * Text Domain: gf-merge-tag-autocomplete
 * Domain Path: /languages
 * Update URI:  https://github.com/guilamu/gf-merge-tag-autocomplete/
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if (! defined('ABSPATH')) {
	exit;
}

define('GF_MTA_VERSION', '1.0.0');
define('GF_MTA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('GF_MTA_PLUGIN_URL', plugin_dir_url(__FILE__));

add_action('plugins_loaded', function () {
	load_plugin_textdomain('gf-merge-tag-autocomplete', false, dirname(plugin_basename(__FILE__)) . '/languages');
}, 10);

add_action('gform_loaded', array('GF_Merge_Tag_Autocomplete_Bootstrap', 'load'), 5);

class GF_Merge_Tag_Autocomplete_Bootstrap
{

	public static function load()
	{
		if (! method_exists('GFForms', 'include_addon_framework')) {
			return;
		}

		require_once GF_MTA_PLUGIN_DIR . 'class-gf-merge-tag-autocomplete.php';
		require_once GF_MTA_PLUGIN_DIR . 'includes/class-github-updater.php';
		GFAddOn::register('GF_Merge_Tag_Autocomplete');
	}
}

/**
 * Register with Guilamu Bug Reporter
 */
add_action('plugins_loaded', function () {
	if (class_exists('Guilamu_Bug_Reporter')) {
		Guilamu_Bug_Reporter::register(array(
			'slug'        => 'gf-merge-tag-autocomplete',
			'name'        => 'GF Merge Tag Autocomplete',
			'version'     => GF_MTA_VERSION,
			'github_repo' => 'guilamu/gf-merge-tag-autocomplete',
		));
	}
}, 20);

/**
 * Add "Report a Bug" link to the plugins list.
 */
add_filter('plugin_row_meta', function ($links, $file) {
	if (plugin_basename(__FILE__) !== $file) {
		return $links;
	}

	if (class_exists('Guilamu_Bug_Reporter')) {
		$links[] = sprintf(
			'<a href="#" class="guilamu-bug-report-btn" data-plugin-slug="gf-merge-tag-autocomplete" data-plugin-name="%s">%s</a>',
			'GF Merge Tag Autocomplete',
			esc_html__('🐛 Report a Bug', 'gf-merge-tag-autocomplete')
		);
	} else {
		$links[] = sprintf(
			'<a href="%s" target="_blank">%s</a>',
			'https://github.com/guilamu/guilamu-bug-reporter/releases',
			esc_html__('🐛 Report a Bug (install Bug Reporter)', 'gf-merge-tag-autocomplete')
		);
	}

	return $links;
}, 10, 2);

/**
 * Helper to get the add-on instance.
 *
 * @return GF_Merge_Tag_Autocomplete
 */
function gf_merge_tag_autocomplete()
{
	return GF_Merge_Tag_Autocomplete::get_instance();
}
