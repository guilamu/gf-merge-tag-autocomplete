/**
 * GF Merge Tag Autocomplete
 *
 * Adds inline autocomplete to all merge-tag-enabled fields (plain inputs,
 * textareas and TinyMCE editors).  Type "{" to trigger, keep typing to
 * filter, use ↑/↓ + Enter to select, Escape to dismiss.
 *
 * @package GF_Merge_Tag_Autocomplete
 * @since   1.0.0
 */

/* global jQuery, form, gf_vars, tinymce, InsertVariable, InsertEditorVariable, gfMergeTagsObj */

(function ($) {
	'use strict';

	/* ------------------------------------------------------------------ */
	/*  State                                                              */
	/* ------------------------------------------------------------------ */

	var DEBUG = false;   // Set to true to see [GF-MTA] logs in console.
	var dropdown = null;   // The <div> dropdown element.
	var activeItems = [];     // Currently visible <div.gf-mta-item> elements.
	var highlightIdx = -1;     // Currently highlighted index.
	var isOpen = false;
	var searchBuffer = '';     // Text typed after the opening "{".
	var triggerTarget = null;   // { type:'input'|'editor', id:string }
	var allTags = [];     // Flat array of { tag, label, group }.
	var originalInput = null;   // The opening "{" character position data.

	/**
	 * Internal logging helper.
	 */
	function log() {
		if (DEBUG && window.console && window.console.log) {
			var args = Array.prototype.slice.call(arguments);
			args.unshift('[GF-MTA]');
			console.log.apply(console, args);
		}
	}

	/* ------------------------------------------------------------------ */
	/*  Bootstrap                                                          */
	/* ------------------------------------------------------------------ */

	$(document).ready(function () {
		log('Document ready. form defined:', typeof window.form !== 'undefined', '| gfMergeTagsObj defined:', typeof window.gfMergeTagsObj !== 'undefined', '| tinymce defined:', typeof window.tinymce !== 'undefined');
		buildDropdown();
		bindPlainFields();
		bindEditors();

		// Re-bind when GF dynamically re-initialises merge tag support.
		$(document).on('gform_load_merge_tags', function () {
			log('gform_load_merge_tags event detected. Re-binding.');
			bindPlainFields();
			bindEditors();
		});

		// Close on outside click.
		$(document).on('mousedown', function (e) {
			if (isOpen && dropdown && !$.contains(dropdown[0], e.target)) {
				close();
			}
		});
	});

	/* ------------------------------------------------------------------ */
	/*  Dropdown DOM                                                       */
	/* ------------------------------------------------------------------ */

	function buildDropdown() {
		dropdown = $('<div id="gf-mta-dropdown" class="gf-mta-dropdown" style="display:none;" role="listbox"></div>');
		$('body').append(dropdown);
	}

	/* ------------------------------------------------------------------ */
	/*  Collect all merge tags                                             */
	/* ------------------------------------------------------------------ */

	function collectTags(elem) {
		allTags = [];

		log('collectTags called. elem:', elem ? (elem.attr ? '#' + elem.attr('id') : elem) : 'null');

		// Try to use the gfMergeTagsObj that GF already attaches to the element.
		var mto = null;

		if (elem && elem.jquery) {
			mto = elem.data('mergeTags');
		}

		// Fallback: build a temporary object with the element so it initialises properly.
		// Use window.gfMergeTagsObj and window.form for better scope safety.
		var gfMTO = window.gfMergeTagsObj;
		var gfForm = window.form;

		// If window.form is not defined, try to find it via GF global if available.
		if (!gfForm && window.gform && typeof window.gform.getForm === 'function') {
			// Extract form ID from current URL if possible, or use 0.
			var searchParams = new URLSearchParams(window.location.search);
			var currentId = searchParams.get('id');
			if (currentId) {
				gfForm = window.gform.getForm(currentId);
			}
		}

		if (!mto && typeof gfMTO === 'function' && typeof gfForm !== 'undefined') {
			var targetElem = (elem && elem.jquery && elem.length) ? elem : $('<input />');
			log('Building temporary gfMergeTagsObj with elem:', targetElem.length ? '#' + (targetElem.attr('id') || '(no id)') : '(detached input)');
			try {
				mto = new gfMTO(gfForm, targetElem);
				log('gfMergeTagsObj created successfully. Has getMergeTags:', typeof mto.getMergeTags);
			} catch (ex) {
				log('gfMergeTagsObj constructor threw:', ex);
				mto = null;
			}
		} else if (!mto) {
			log('Cannot build fallback. gfMergeTagsObj:', typeof gfMTO, '| form:', typeof gfForm);
		}

		if (!mto || typeof mto.getMergeTags !== 'function') {
			log('No valid mto object found. Skipping tag collection.');
			return;
		}

		var fields = (gfForm && gfForm.fields) ? gfForm.fields : [];
		var elementId = (elem && elem.jquery && elem.length) ? elem.attr('id') : '';
		var hideAll = false;
		var exclude = [];
		var isPrepop = false;
		var option = '';

		if (typeof mto.getClassProperty === 'function' && elem && elem.jquery && elem.length) {
			hideAll = mto.getClassProperty(elem, 'hide_all_fields') === true;
			exclude = mto.getClassProperty(elem, 'exclude') || [];
			isPrepop = mto.getClassProperty(elem, 'prepopulate') || false;
			option = mto.getClassProperty(elem, 'option') || '';
		}

		if (isPrepop) {
			hideAll = true;
		}

		var groups;
		try {
			// Ensure elementId is at least an empty string to avoid crashes in some GF versions.
			groups = mto.getMergeTags(fields, elementId || '', hideAll, exclude, isPrepop, option);
		} catch (ex) {
			log('mto.getMergeTags failed:', ex);
			return;
		}

		if (!groups) {
			log('mto.getMergeTags returned null/undefined.');
			return;
		}

		for (var groupKey in groups) {
			if (!groups.hasOwnProperty(groupKey)) {
				continue;
			}
			var grp = groups[groupKey];
			var tags = grp.tags;
			if (!tags || !tags.length) {
				continue;
			}
			for (var i = 0; i < tags.length; i++) {
				allTags.push({
					tag: tags[i].tag,
					label: tags[i].label,
					group: grp.label || ''
				});
			}
		}

		log('Collected ' + allTags.length + ' tags.');
	}

	/* ------------------------------------------------------------------ */
	/*  Filtering & rendering                                              */
	/* ------------------------------------------------------------------ */

	function renderList(filter) {
		dropdown.empty();
		highlightIdx = -1;
		activeItems = [];

		var lowerFilter = (filter || '').toLowerCase();
		var lastGroup = '';

		// Score and sort: items that match get a relevance score.
		var scored = [];
		for (var i = 0; i < allTags.length; i++) {
			var t = allTags[i];
			var score = getMatchScore(t, lowerFilter);
			if (lowerFilter && score === 0) {
				continue;
			}
			scored.push({ item: t, score: score, origIdx: i });
		}

		// Sort by score descending, then original order.
		scored.sort(function (a, b) {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return a.origIdx - b.origIdx;
		});

		for (var j = 0; j < scored.length; j++) {
			var t = scored[j].item;

			// Group header.
			if (t.group && t.group !== lastGroup) {
				lastGroup = t.group;
				dropdown.append('<div class="gf-mta-group">' + escapeHtml(t.group) + '</div>');
			}

			var item = $('<div class="gf-mta-item" role="option" tabindex="-1"></div>')
				.attr('data-tag', t.tag);

			var itemLabel = $('<span class="gf-mta-item-label"></span>').text(t.label);
			var itemTag = $('<span class="gf-mta-item-tag"></span>').text(t.tag);
			item.append(itemLabel).append(itemTag);

			item.on('mousedown', function (e) {
				e.preventDefault();          // Prevent blur before insertion.
				selectTag($(this).attr('data-tag'));
			});

			item.on('mouseenter', function () {
				setHighlight(activeItems.indexOf(this));
			});

			dropdown.append(item);
			activeItems.push(item[0]);
		}

		if (activeItems.length === 0 && lowerFilter) {
			var noResultsText = (typeof gf_mta_autocomplete_strings !== 'undefined' && gf_mta_autocomplete_strings.no_results) ? gf_mta_autocomplete_strings.no_results : 'No merge tags found';
			dropdown.append('<div class="gf-mta-empty">' + escapeHtml(noResultsText) + '</div>');
		}

		// Auto-highlight first item.
		if (activeItems.length > 0) {
			setHighlight(0);
		}
	}

	function setHighlight(idx) {
		if (idx < 0 || idx >= activeItems.length) {
			return;
		}
		// Remove previous.
		if (highlightIdx >= 0 && highlightIdx < activeItems.length) {
			$(activeItems[highlightIdx]).removeClass('gf-mta-highlight');
		}
		highlightIdx = idx;
		$(activeItems[highlightIdx]).addClass('gf-mta-highlight');

		// Scroll into view.
		activeItems[highlightIdx].scrollIntoView({ block: 'nearest' });
	}

	/* ------------------------------------------------------------------ */
	/*  Open / close                                                       */
	/* ------------------------------------------------------------------ */

	function open(rect) {
		log('open() called with rect:', rect);
		if (!rect) {
			log('No rect provided to open(). Closing.');
			close();
			return;
		}

		var scrollTop = $(window).scrollTop();
		var scrollLeft = $(window).scrollLeft();

		log('Window scroll:', scrollTop, scrollLeft);

		dropdown.css({
			top: rect.bottom + scrollTop + 4,
			left: rect.left + scrollLeft,
			display: 'block'
		});

		log('Dropdown CSS applied. top:', dropdown.css('top'), 'left:', dropdown.css('left'), 'display:', dropdown.css('display'), 'z-index:', dropdown.css('z-index'));

		isOpen = true;
	}

	function close() {
		if (!isOpen) {
			return;
		}
		dropdown.hide().empty();
		isOpen = false;
		searchBuffer = '';
		highlightIdx = -1;
		activeItems = [];
		triggerTarget = null;
		originalInput = null;
	}

	/* ------------------------------------------------------------------ */
	/*  Tag selection                                                       */
	/* ------------------------------------------------------------------ */

	function selectTag(tag) {
		if (!triggerTarget) {
			close();
			return;
		}

		if (triggerTarget.type === 'editor') {
			insertIntoEditor(triggerTarget.id, tag);
		} else {
			insertIntoInput(triggerTarget.id, tag);
		}

		close();
	}

	/**
	 * Insert into a plain <input> or <textarea>.
	 * We need to replace the typed "{…" with the full tag.
	 */
	function insertIntoInput(elemId, tag) {
		var el = document.getElementById(elemId);
		if (!el) {
			return;
		}

		var val = el.value;
		var bracePos = originalInput ? originalInput.start - 1 : el.selectionStart; // position of the "{" char.
		var afterPos = originalInput ? originalInput.start + searchBuffer.length : el.selectionStart;

		// Everything before the "{" we typed.
		var before = val.substring(0, bracePos);
		// Everything after the "{" + search chars the user typed.
		var after = val.substring(afterPos);

		// Insert the full tag (which already includes its own "{").
		el.value = before + tag + after;

		// Place cursor right after the inserted tag.
		var newPos = before.length + tag.length;
		el.selectionStart = el.selectionEnd = newPos;

		$(el).trigger('input').trigger('propertychange');
	}

	/**
	 * Insert into TinyMCE editor.
	 * Remove the typed "{…" first, then insert the full merge tag.
	 */
	function insertIntoEditor(editorId, tag) {
		var editor = tinymce.get(editorId);
		if (!editor) {
			return;
		}

		// Delete the "{" + any search characters we typed.
		var rng = editor.selection.getRng();
		var container = rng.startContainer;

		if (container.nodeType === 3) {  // Text node.
			var text = container.textContent;
			var cursorAt = rng.startOffset;
			// Walk backwards to find our "{".
			var bracePos = text.lastIndexOf('{', cursorAt - 1);
			if (bracePos !== -1) {
				container.textContent = text.substring(0, bracePos) + text.substring(cursorAt);
				// Set cursor right after bracePos.
				rng.setStart(container, bracePos);
				rng.setEnd(container, bracePos);
				editor.selection.setRng(rng);
			}
		}

		editor.execCommand('mceInsertContent', false, tag);
	}

	/* ------------------------------------------------------------------ */
	/*  Positioning helpers                                                */
	/* ------------------------------------------------------------------ */

	/**
	 * Get a bounding rect near the caret of a plain input/textarea.
	 * Uses a mirror-div technique for textareas, or element rect for inputs.
	 */
	function getCaretRect(el) {
		var $el = $(el);
		var offset = $el.offset();

		// For single-line inputs, just position below the field.
		if (el.tagName === 'INPUT') {
			return {
				top: offset.top,
				bottom: offset.top + $el.outerHeight(),
				left: offset.left
			};
		}

		// For textareas, try to approximate caret position using a hidden mirror div.
		return getTextareaCaretRect(el);
	}

	/**
	 * Create a temporary mirror to approximate textarea caret coordinates.
	 */
	function getTextareaCaretRect(el) {
		var $el = $(el);
		var value = el.value.substring(0, el.selectionStart);

		var mirror = $('<div></div>').css({
			position: 'absolute',
			visibility: 'hidden',
			whiteSpace: 'pre-wrap',
			wordWrap: 'break-word',
			overflow: 'hidden',
			width: $el.width(),
			fontFamily: $el.css('font-family'),
			fontSize: $el.css('font-size'),
			lineHeight: $el.css('line-height'),
			padding: $el.css('padding'),
			border: $el.css('border')
		});

		var span = $('<span>|</span>');
		mirror.text(value).append(span);
		$('body').append(mirror);

		var offset = $el.offset();
		var spanPos = span.position();

		var rect = {
			top: offset.top + spanPos.top - el.scrollTop,
			bottom: offset.top + spanPos.top - el.scrollTop + parseInt($el.css('line-height'), 10),
			left: offset.left + spanPos.left
		};

		mirror.remove();
		return rect;
	}

	/**
	 * Get a caret rect from inside a TinyMCE editor.
	 */
	function getEditorCaretRect(editorId) {
		var editor = tinymce.get(editorId);
		if (!editor) {
			log('getEditorCaretRect: editor not found:', editorId);
			return null;
		}

		var rng = editor.selection.getRng();

		log('getEditorCaretRect: range startContainer nodeType:', rng.startContainer.nodeType);

		// Try to get rect directly from range first (modern browsers).
		var rects = rng.getClientRects();
		if (rects && rects.length > 0) {
			var r = rects[0];
			log('Direct range rect found:', r);
			// If rect is mostly empty (width 0), still try marker for better accuracy.
			if (r.width > 0 || r.height > 0) {
				return calculateAbsoluteRect(editorId, r);
			}
		}

		// Fallback: Insert a temporary zero-width span at caret to measure position.
		log('Attempting marker insertion via insertNode...');
		var marker = editor.dom.create('span', { id: 'gf-mta-caret-marker', 'data-mce-bogus': '1' }, '\u200B');

		try {
			rng.insertNode(marker);
		} catch (ex) {
			log('Failed to insertNode marker:', ex);
			// Last ditch effort: mceInsertContent
			try {
				editor.execCommand('mceInsertContent', false, '<span id="gf-mta-caret-marker" data-mce-bogus="1">\u200B</span>');
				marker = editor.dom.get('gf-mta-caret-marker');
			} catch (ex2) {
				log('Failed mceInsertContent marker:', ex2);
			}
		}

		if (!marker) {
			log('Marker element not found in editor DOM after all attempts.');
			return null;
		}

		var markerRect = marker.getBoundingClientRect();
		log('Marker rect:', markerRect);

		var finalRect = calculateAbsoluteRect(editorId, markerRect);

		// Remove marker.
		editor.dom.remove(marker);

		return finalRect;
	}

	/**
	 * Convert a relative editor rect to absolute page coordinates.
	 */
	function calculateAbsoluteRect(editorId, relativeRect) {
		var iframe = $('#' + editorId + '_ifr');
		if (!iframe.length) {
			log('Iframe not found for editorId:', editorId);
			return null;
		}

		var iframeRect = iframe[0].getBoundingClientRect();
		log('Iframe rect:', iframeRect);

		var rect = {
			top: iframeRect.top + relativeRect.top,
			bottom: iframeRect.top + relativeRect.bottom,
			left: iframeRect.left + relativeRect.left
		};

		log('Calculated absolute rect:', rect);
		return rect;
	}

	/* ------------------------------------------------------------------ */
	/*  Plain input / textarea bindings                                    */
	/* ------------------------------------------------------------------ */

	/* ------------------------------------------------------------------ */
	/*  Plain input / textarea bindings                                    */
	/* ------------------------------------------------------------------ */

	function bindPlainFields() {
		$(document).off('keydown.gfmta');
		$(document).on('keydown.gfmta', '.merge-tag-support', handlePlainKeyDown);
	}

	function handlePlainKeyDown(e) {
		var el = e.target;

		// --- While dropdown is open: handle navigation keys. ---
		if (isOpen && triggerTarget && triggerTarget.type === 'input' && triggerTarget.id === el.id) {
			switch (e.keyCode) {
				case 13: // Enter
					e.preventDefault();
					e.stopImmediatePropagation();
					e.stopPropagation();
					if (highlightIdx >= 0 && highlightIdx < activeItems.length) {
						selectTag($(activeItems[highlightIdx]).attr('data-tag'));
					}
					return false;

				case 27: // Escape
					e.preventDefault();
					close();
					return;

				case 38: // Up
					e.preventDefault();
					if (highlightIdx > 0) {
						setHighlight(highlightIdx - 1);
					}
					return;

				case 40: // Down
					e.preventDefault();
					if (highlightIdx < activeItems.length - 1) {
						setHighlight(highlightIdx + 1);
					}
					return;

				case 9:  // Tab
					e.preventDefault();
					if (highlightIdx >= 0 && highlightIdx < activeItems.length) {
						selectTag($(activeItems[highlightIdx]).attr('data-tag'));
					} else {
						close();
					}
					return;

				case 8:  // Backspace
					// Let it happen, then re-filter.
					setTimeout(function () { updatePlainFilter(el); }, 0);
					return;

				default:
					// Let character be typed, then re-filter.
					setTimeout(function () { updatePlainFilter(el); }, 0);
					return;
			}
		}

		// --- Detect "{" to trigger. ---
		// Handle both character and physical key fallbacks.
		var isOpenBrace = false;

		if (e.key === '{') {
			isOpenBrace = true;
		} else if ((e.keyCode === 219 || e.code === 'BracketLeft') && (e.shiftKey || e.altKey)) {
			// Some layouts use AltGr or Shift for {
			isOpenBrace = true;
		}

		if (!isOpenBrace) {
			return;
		}

		log('Possible trigger detected in input:', el.id);

		// Collect tags for this element.
		collectTags($(el));
		if (!allTags || allTags.length === 0) {
			log('No tags available for this field. Aborting.');
			return;
		}

		triggerTarget = { type: 'input', id: el.id };
		searchBuffer = '';

		// We store position BEFORE the "{" is actually inserted into the value.
		originalInput = {
			start: el.selectionStart + 1
		};

		renderList('');

		// Defer positioning slightly so the "{" is rendered first.
		setTimeout(function () {
			var rect = getCaretRect(el);
			open(rect);
		}, 10);
	}

	function updatePlainFilter(el) {
		if (!isOpen || !originalInput) {
			return;
		}

		var val = el.value;
		var start = originalInput.start;  // Position right after the "{".
		var end = el.selectionStart;

		// If cursor went before the "{" or the "{" was deleted, close.
		if (end < start || val.charAt(start - 1) !== '{') {
			close();
			return;
		}

		searchBuffer = val.substring(start, end);
		renderList(searchBuffer);

		// If "}" was typed, close without selecting.
		if (searchBuffer.indexOf('}') !== -1) {
			close();
		}
	}

	/* ------------------------------------------------------------------ */
	/*  TinyMCE bindings                                                   */
	/* ------------------------------------------------------------------ */

	function bindEditors() {
		var tm = window.tinymce;
		if (typeof tm === 'undefined') {
			log('bindEditors: tinymce is undefined, skipping.');
			return;
		}

		log('bindEditors: tinymce found. Existing editors:', tm.editors.length);

		// Bind to already-initialized editors.
		for (var i = 0; i < tm.editors.length; i++) {
			attachToEditor(tm.editors[i]);
		}

		// Bind to editors initialized later.
		tm.on('AddEditor', function (e) {
			log('AddEditor event:', e.editor ? e.editor.id : 'null');
			if (e.editor) {
				// Wait for Init or PostRender to be safe.
				e.editor.on('init', function () {
					log('Editor init:', e.editor.id);
					attachToEditor(e.editor);
				});
			}
		});
	}

	function attachToEditor(editor) {
		if (!editor || editor._gfMtaBound) {
			return;
		}
		editor._gfMtaBound = true;

		log('attachToEditor: binding keydown to:', editor.id);
		editor.on('keydown', function (e) {
			handleEditorKeyDown(e, editor);
		});
	}

	function handleEditorKeyDown(e, editor) {
		var editorId = editor.id;

		// --- While dropdown is open: handle navigation keys. ---
		if (isOpen && triggerTarget && triggerTarget.type === 'editor' && triggerTarget.id === editorId) {
			switch (e.keyCode) {
				case 13: // Enter
					e.preventDefault();
					e.stopImmediatePropagation();
					e.stopPropagation();
					if (highlightIdx >= 0 && highlightIdx < activeItems.length) {
						selectTag($(activeItems[highlightIdx]).attr('data-tag'));
					}
					return false;

				case 27: // Escape
					e.preventDefault();
					close();
					return;

				case 38: // Up
					e.preventDefault();
					if (highlightIdx > 0) {
						setHighlight(highlightIdx - 1);
					}
					return;

				case 40: // Down
					e.preventDefault();
					if (highlightIdx < activeItems.length - 1) {
						setHighlight(highlightIdx + 1);
					}
					return;

				case 9:  // Tab
					e.preventDefault();
					if (highlightIdx >= 0 && highlightIdx < activeItems.length) {
						selectTag($(activeItems[highlightIdx]).attr('data-tag'));
					} else {
						close();
					}
					return;

				case 8:  // Backspace
					setTimeout(function () { updateEditorFilter(editor); }, 0);
					return;

				default:
					setTimeout(function () { updateEditorFilter(editor); }, 0);
					return;
			}
		}

		// --- Detect "{" to trigger. ---
		var isOpenBrace = false;
		if (e.key === '{') {
			isOpenBrace = true;
		} else if ((e.keyCode === 219 || e.code === 'BracketLeft') && (e.shiftKey || e.altKey)) {
			isOpenBrace = true;
		}

		if (!isOpenBrace) {
			return;
		}

		log('"{" detected in editor:', editorId);

		// The editor ID in TinyMCE might be "_gform_setting_message" 
		// but the jQuery element might be just "gform_setting_message" or vice versa.
		var $elem = $('#' + editorId);
		if (!$elem.length) {
			var altId = editorId.replace(/^_/, '');
			$elem = $('#' + altId);
		}

		// Fallback to finding editor DOM element directly if necessary.
		if (!$elem.length && editor.getElement) {
			$elem = $(editor.getElement());
		}

		log('Found editor parent element:', $elem.length ? '#' + $elem.attr('id') : 'none');

		collectTags($elem);
		if (!allTags || allTags.length === 0) {
			log('No tags available for this editor. Aborting.');
			return;
		}

		triggerTarget = { type: 'editor', id: editorId };
		searchBuffer = '';

		renderList('');

		setTimeout(function () {
			var rect = getEditorCaretRect(editorId);
			open(rect);
		}, 10);
	}

	function updateEditorFilter(editor) {
		if (!isOpen) {
			return;
		}

		var rng = editor.selection.getRng();
		var container = rng.startContainer;

		if (container.nodeType !== 3) {
			close();
			return;
		}

		var text = container.textContent;
		var cursorAt = rng.startOffset;
		var bracePos = text.lastIndexOf('{', cursorAt - 1);

		if (bracePos === -1) {
			close();
			return;
		}

		searchBuffer = text.substring(bracePos + 1, cursorAt);

		// If "}" was typed, close.
		if (searchBuffer.indexOf('}') !== -1) {
			close();
			return;
		}

		renderList(searchBuffer);
	}

	/* ------------------------------------------------------------------ */
	/*  Utility                                                            */
	/* ------------------------------------------------------------------ */

	/**
	 * Score a merge tag item against a filter string.
	 * Now supports accent-insensitive matching.
	 */
	function getMatchScore(item, lowerFilter) {
		if (!lowerFilter) {
			return 1;
		}

		// Normalize filter and item strings (remove accents).
		var normFilter = normalizeString(lowerFilter);
		var normLabel = normalizeString(item.label.toLowerCase());
		var normTag = normalizeString(item.tag.toLowerCase());

		if (normLabel.indexOf(normFilter) === 0) {
			return 3;
		}
		if (normTag.indexOf('{' + normFilter) === 0) {
			return 2;
		}
		if (normLabel.indexOf(normFilter) !== -1 || normTag.indexOf(normFilter) !== -1) {
			return 1;
		}
		return 0;
	}

	/**
	 * Remove diacritics (accents) from a string.
	 * e.g. "écoles" -> "ecoles"
	 */
	function normalizeString(str) {
		if (typeof str !== 'string') {
			return '';
		}
		// String.prototype.normalize('NFD') decomposes characters into base + diacritics.
		// The regex then removes the diacritics.
		return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	}

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.appendChild(document.createTextNode(str));
		return div.innerHTML;
	}

})(jQuery);