<?php

/**
 * GF Merge Tag Autocomplete Add-On Class.
 *
 * @package GF_Merge_Tag_Autocomplete
 */

if (! defined('ABSPATH')) {
	exit;
}

GFForms::include_addon_framework();

/**
 * Main add-on class — enqueues the JS that powers inline merge tag autocomplete.
 */
class GF_Merge_Tag_Autocomplete extends GFAddOn
{

	protected $_version                  = GF_MTA_VERSION;
	protected $_min_gravityforms_version = '2.5';
	protected $_slug                     = 'gf-merge-tag-autocomplete';
	protected $_path                     = 'gf-merge-tag-autocomplete/gf-merge-tag-autocomplete.php';
	protected $_full_path                = __FILE__;
	protected $_title                    = 'GF Merge Tag Autocomplete';
	protected $_short_title              = 'Merge Tag AC';

	/**
	 * @var GF_Merge_Tag_Autocomplete|null
	 */
	private static $_instance = null;

	/**
	 * Singleton accessor.
	 *
	 * @return GF_Merge_Tag_Autocomplete
	 */
	public static function get_instance()
	{
		if (null === self::$_instance) {
			self::$_instance = new self();
		}
		return self::$_instance;
	}

	/**
	 * Enqueue admin scripts on GF pages that have merge tag support.
	 *
	 * @return array
	 */
	public function scripts()
	{
		$scripts = array(
			array(
				'handle'  => 'gf_mta_autocomplete',
				'src'     => $this->get_base_url() . '/js/merge-tag-autocomplete.js',
				'version' => $this->_version,
				'deps'    => array('jquery', 'gform_form_admin'),
				'enqueue' => array(
					array(
						'admin_page' => array(
							'form_settings',
							'form_editor',
							'notification_edit',
							'confirmation',
							'plugin_settings',
							'entry_detail',
						),
					),
				),
				'strings' => array(
					'no_results' => __('No merge tags found', 'gf-merge-tag-autocomplete'),
				),
			),
		);

		return array_merge(parent::scripts(), $scripts);
	}

	/**
	 * Enqueue admin styles.
	 *
	 * @return array
	 */
	public function styles()
	{
		$styles = array(
			array(
				'handle'  => 'gf_mta_autocomplete_css',
				'src'     => $this->get_base_url() . '/css/merge-tag-autocomplete.css',
				'version' => $this->_version,
				'enqueue' => array(
					array(
						'admin_page' => array(
							'form_settings',
							'form_editor',
							'notification_edit',
							'confirmation',
							'plugin_settings',
							'entry_detail',
						),
					),
				),
			),
		);

		return array_merge(parent::styles(), $styles);
	}
}
