# GF Merge Tag Autocomplete

Inline merge tag autocomplete for Gravity Forms — type `{` to instantly search and insert tags without clicking the merge tag button.

## Effortless Workflow
- **Instant Search:** Type `{` in any merge-tag-enabled field to open the autocomplete dropdown.
- **Robust Triggering:** Works across different keyboard layouts and languages.
- **Live Filtering:** Keep typing to filter the list instantly; the query is compared against both labels and tags.

## Better Editor Integration
- **TinyMCE Support:** Fully integrated with TinyMCE editors used in Gravity Forms (e.g., Notification messages).
- **Plain Inputs & Textareas:** Seamlessly works in standard text fields and settings areas.
- **Smart Replacement:** Automatically replaces your search query and the opening brace with the correctly formatted merge tag.

## Key Features
- **Accent-Insensitive:** Search matches terms regardless of accents (e.g., "ecole" matches "École").
- **Multilingual:** Works with content in any language and handles international keyboard layouts.
- **Translation-Ready:** All strings are internationalized for easy localization.
- **Secure:** Built using native Gravity Forms APIs and follows WordPress security best practices.
- **GitHub Updates:** Supports automatic updates directly from GitHub releases.
- **Built-in Debugging:** Includes a toggleable debug mode for troubleshooting integration issues.

## Requirements
- WordPress 5.8 or higher
- PHP 7.4 or higher
- Gravity Forms (2.5+ recommended)

## Installation
1. Upload the `gf-merge-tag-autocomplete` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the **Plugins** menu in WordPress
3. Navigate to a Gravity Forms editor or notification setting
4. Type `{` in any supported field to see the autocomplete in action

## FAQ

### How do I trigger the autocomplete?
Simply type the opening curly brace `{` in any supported field.

### Does it work in the TinyMCE editor?
Yes! It is fully compatible with TinyMCE editors, such as those used in form notifications or advanced message fields.

### Can I search for tags with accents?
Yes, the search is accent-insensitive. For example, typing "ecoles" will correctly match a merge tag labeled "Écoles".

### How do I navigate the suggestions?
Use the **Up** and **Down** arrow keys to highlight a tag, and press **Tab** or **Enter** to select and insert it. Use **Escape** to dismiss the dropdown.

## Project Structure
```
.
├── gf-merge-tag-autocomplete.php      # Main plugin entry point & registration
├── class-gf-merge-tag-autocomplete.php # Core add-on class for enqueuing assets
├── includes
│   └── class-github-updater.php       # Handles automatic updates from GitHub
├── js
│   └── merge-tag-autocomplete.js      # Main trigger, collection, and UI logic
├── css
│   └── merge-tag-autocomplete.css     # Dropdown and item styling
├── languages
│   ├── gf-merge-tag-autocomplete.pot  # Translation template
│   └── gf-merge-tag-autocomplete-fr_FR.po # French translation source
└── README.md                          # Plugin documentation
```

## Changelog

### 1.0.0
- Initial release
- Robust `{` trigger detection for plain inputs and TinyMCE
- Accent-insensitive search matching
- Automatic GitHub update integration
- Guilamu Bug Reporter integration

## License
This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with love for the WordPress community
</p>
