define(['jquery', 'codemirror/lib/codemirror'], function($, CodeMirror) {
    
    var CodeMirrorRte;

    /**
     * @class
     * CodeMirrorRte
     *
     * Interface for turning the CodeMirror plain text editor into a "rich text" editor.
     * This object provides the following:
     * - the editor area
     * - configurations for which styles and elements are allowed
     * - methods for importing and exporting HTML
     * - track changes functionality
     * - functions to add enhancements (external content) and move enhancements
     *
     * It does *not* provide a toolbar, etc.
     *
     * This should generally not be used as a stand-alone interface,
     * rather it is used as part of another interface that also provides
     * a toolbar, etc.
     *
     * All CodeMirror-specific functionality should be here - other code
     * should never directly call CodeMirror functions.
     *
     * @example
     * editor = Object.create(CodeMirrorRte);
     * editor.styles = $.extend(true, {}, editor.styles, {bold:{className:'rte2-style-bold', element:'b'}});
     * editor.init('#mytextarea');
     */
    CodeMirrorRte = {

        /**
         * List of all the class names that are used within the rich text editor
         * and some additional information on the type of HTML element it should map to.
         * You can modify this object to add styles to be supported by the editor.
         *
         * String className
         * The class that is used to style the element in the rich text editor.
         *
         * String [element]
         * The element that is created when translating rich text to HTML.
         * If not specified then this style will not have output HTML (only plain text).
         *
         * String [elementAttr]
         * A list of attributes that are applied to the output HTML element.
         *
         * String [elementContainer]
         * A container elment that surrounds the element in the HTML output.
         * For example, one or more 'li' elements are contained by a 'ul' or 'ol' element.
         *
         * Boolean [line]
         * Set to true if this is a block element that applies to an entire line.
         * 
         * Array [clear]
         * A list of styles that should be cleared if the style is selected.
         * Use this to make mutually-exclusive styles.
         *
         * Boolean [internal]
         * Set this to true if the style is used internally (for track changes).
         * When internal is true, then the style will not be removed by the RemoveStyle functions
         * unless the style name is explicitely provided.
         * For example, if you select a range and tell the RTE to clear all the styles,
         * it will clear the formatting styles like bold and italic, but not the internal
         * styles like trackInsert and trackDelete.
         * However, an internal style can still output HTML elements.
         *
         * Function [fromHTML($el, mark)]
         * A function that extracts additional information from the HTML element
         * and adds it to the mark object for future use.
         *
         * Function [toHTML(mark)]
         * A function that reads additional information saved on the mark object,
         * and uses it to ouput HTML for the style.
         *
         * Function [onClick(mark)]
         * A function that handles clicks on the mark. It can read additional information
         * saved on the mark, and modify that information.
         * Note at this time an onClick can be used only for inline styles.
         */
        styles: {

            // Special style for raw HTML. 
            // This will be used when we import HTML that we don't understand.
            // Also can be used to mark text that user wants to treat as html
            html: {
                className: 'rte2-style-html',
                raw: true // do not allow other styles inside this style and do not encode the text within this style, to allow for raw html
            },
            
            // Special style used to collapse an element.
            // It does not output any HTML, but it can be cleared.
            // You can use the class name to make CSS rules to style the collapsed area.
            // This can be used for example to collapse comments.
            collapsed: {
                className: 'rte2-style-collapsed'
            },

            // Special styles used for tracking changes
            trackInsert: {
                className: 'rte2-style-track-insert',
                element: 'ins',
                internal: true
            },
            trackDelete: {
                className: 'rte2-style-track-delete',
                element: 'del',
                internal: true
            },

            // The following styles are used internally to show the final results of the user's tracked changes.
            // The user can toggle between showing the tracked changes (insertions and deletions) or showing
            // the final result.
            
            trackDeleteHidden: {
                // This class is used internally to hide deleted content temporarily.
                // It does not create an element for output.
                className: 'rte2-style-track-delete-hidden',
                internal: true
            },
            trackDisplay: {
                // This class is placed on the wrapper elemnt for the entire editor,
                // and is used to remove the colors from inserted content temporarily.
                // It does not create an element for output.
                className: 'rte2-style-track-display',
                internal:true
            }
        }, // styles

        
        /**
         * Should we track changes?
         * Note: do not set this directly, use trackSet() or trackToggle()
         */
        trackChanges: false,


        /**
         * For track changes should we show the final result?
         * If true, show the orignal results marked up with changes.
         * If false, show the final results without the tracked changes.
         * Note: do not set this directly, use trackDisplaySet() because other things happen when the value is changed.
         */
        trackDisplay: true,


        /**
         * List of elements that should cause a new line when importing from HTML.
         * We don't necessarily list them all, just the ones we are likely to encounter.
         */
        newLineRegExp: /^(br)$/,


        /**
         * List of elements that do not need to be </closed>
         */
        voidElements: {
            'area': true,
            'base': true,
            'br': true,
            'col': true,
            'command': true,
            'hr': true,
            'img': true,
            'input': true,
            'keygen': true,
            'link': true,
            'meta': true,
            'param': true,
            'source': true
        },

        
        /**
         *
         */
        init: function(element, options) {

            var self;

            self = this;

            if (options) {
                $.extend(true, self, options);
            }

            self.$el = $(element).first();

            codeMirrorOptions = {
                lineWrapping: true,
                dragDrop: false,
                mode:null,
                extraKeys: self.getKeys()
            };
            
            // Create the codemirror object
            if (self.$el.is('textarea')) {
                self.codeMirror = CodeMirror.fromTextArea(self.$el[0], codeMirrorOptions);
            } else {
                self.codeMirror = CodeMirror(self.$el[0], codeMirrorOptions);
            }

            // Create a mapping from self.styles so we can perform quick lookups on the classname
            self.classes = self.getClassNameMap();

            self.enhancementInit();
            self.initListListeners();
            self.initClickListener();
            self.initEvents();
            self.trackInit();
        },

        
        /**
         * Set up listener for lists:
         * If you are on a list line at the first character of the line and you press enter,
         * this will move the current line down. If the previous line was also a list,
         * then the new line created above should also be a list item.
         * If you are on a list line but not at the first character and you press enter,
         * this will add a new line below, and the new line should always be a list item.
         */
        initListListeners: function() {

            var editor, isFirstListItem, isLastListItem, isEmptyLine, listType, rangeFirstLine, self;

            self = this;
            
            editor = self.codeMirror;

            // Monitor the "beforeChange" event so we can save certain information
            // about lists, to later use in the "change" event
            editor.on('beforeChange', function(instance, changeObj) {

                var listTypePrevious, listTypeNext, rangeBeforeChange;

                // Get the listType and set the closure variable for later use
                listType = self.blockGetListType(changeObj.from.line);

                rangeFirstLine = {from:changeObj.from, to:changeObj.from};
                rangeBeforeChange = {from:changeObj.from, to:changeObj.to};

                // Get the list type of the previous line
                listTypePrevious = '';
                if (rangeBeforeChange.from.line > 0) {
                    listTypePrevious = self.blockGetListType(rangeBeforeChange.from.line - 1);
                }

                // Get the list type of the next line
                listTypeNext = '';
                if (rangeBeforeChange.to.line < editor.lineCount() - 1) {
                    listTypeNext = self.blockGetListType(rangeBeforeChange.to.line + 1);
                }
                
                isFirstListItem = Boolean(listTypePrevious === '');
                isLastListItem = Boolean(listTypeNext === '');

                isStartOfLine = Boolean(rangeBeforeChange.from.ch === 0);
                
                isEmptyLine = Boolean(editor.getLine(rangeBeforeChange.from.line) === '');
                
                // Loop through all the changes that have not yet been applied, and determine if more text will be added to the line
                $.each(changeObj.text, function(i, textChange) {
                    
                    // Check if this change has more text to add to the page
                    if (textChange.length > 0) {
                        isEmptyLine = false;
                        return false; // stop looping because we found some text and now we know the line will not be empty
                    }
                });

            });
            
            // Monitor the "change" event so we can adjust styles for list items
            // This will use the closure variables set in the "beforeChange" event.
            editor.on('change', function(instance, changeObj) {

                var range;
                
                // Check for a listType that was saved by the beforeChange event
                if (listType) {

                    // Get the current range (after the change has been applied)
                    range = self.getRange();
                    
                    // For the new line, if user pressed enter on a blank list item and it was the last item in the list,
                    // Then do not add a new line - instead change the list item to a non-list item
                    if (isLastListItem && isEmptyLine) {

                        // Remove the list class on the new line
                        self.blockRemoveStyle(listType, range);
                        
                    } else if (isFirstListItem && isStartOfLine) {

                        // If at the first character of the first list item and user presses enter,
                        // do not create a new list item above it, just move the entire list down
                        
                    } else {
                        
                        // Always keep the original starting line the list style.
                        // This is used in the case when you press enter and move the current
                        // line lower - so we need to add list style to the original starting point.
                        // TODO: not sure what happens when you insert multiple line
                        self.blockSetStyle(listType, rangeFirstLine);

                        // Set list style for the new range
                        self.blockSetStyle(listType, range);
                    }
                }

            });
        }, // initListListeners


        /**
         * Set up listener for clicks.
         * If a style has an onClick parameter, then when user clicks that
         * style we will call the onClick function and pass it the mark.
         */
        initClickListener: function() {

            var editor, now, self;

            self = this;
            
            editor = self.codeMirror;

            // CodeMirror doesn't handle double clicks reliably,
            // so we will simulate a double click event using mousedown.
            $(editor.getWrapperElement()).on('mousedown', function(event) {

                var $el, marks, now, pos;

                // Generate timestamp
                now = Date.now();

                if (self.doubleClickTimestamp
                    && now - self.doubleClickTimestamp < 500 ) {

                    // Figure out the line and character based on the mouse coord that was clicked
                    pos = editor.coordsChar({left:event.pageX, top:event.pageY}, 'page');

                    // Loop through all the marks for the clicked position
                    marks = editor.findMarksAt(pos);
                    $.each(marks, function(i, mark) {
                        var styleObj;
                        styleObj = self.classes[mark.className];
                        if (styleObj && styleObj.onClick) {
                            styleObj.onClick(event, mark);
                        }
                    });

                } else {
                    self.doubleClickTimestamp = now;
                }
            });

        }, // initClickListener


        /**
         * Set up some special events.
         *
         * rteCursorActivity = the cursor has changed in the editor.
         * You can use this to update a toolbar for example.
         *
         * rteChange = a change has been made to the editor content.
         * You can use this to update the character count for example.
         */
        initEvents: function() {
            
            var editor, self;

            self = this;
            
            editor = self.codeMirror;

            editor.on('cursorActivity', function(instance, event) {
                self.$el.trigger('rteCursorActivity', [self]);
            });
            
            editor.on('changes', function(instance, event) {
                self.$el.trigger('rteChange', [self]);
            });
        },


        //==================================================
        // STYLE FUNCTIONS
        // The following functions deal with inline or block styles.
        //==================================================
        
        /**
         * Toggle an inline or block style for a range.
         *
         * @param {String} styleKey
         * Name of the style to set (from the styles definition object)
         *
         * @param {Object} [range=current range]
         *
         * @see inlineSetStyle(), blockSetStyle()
         */
        toggleStyle: function(style, range) {
            
            var mark, self, styleObj;

            self = this;
            
            styleObj = self.styles[style];
            if (styleObj) {
                if (styleObj.line) {
                    mark = self.blockToggleStyle(style, range);
                } else {
                    mark = self.inlineToggleStyle(style, range);
                }
            }
            return mark;
        },

        
        /**
         * Set an inline or block style for a range.
         *
         * @param {String} styleKey
         * Name of the style to set (from the styles definition object)
         *
         * @param {Object} [range=current range]
         *
         * @see inlineSetStyle(), blockSetStyle()
         */
        setStyle: function(style, range) {
            
            var mark, self, styleObj;

            self = this;
            
            styleObj = self.styles[style];
            if (styleObj) {
                if (styleObj.line) {
                    self.blockSetStyle(style, range);
                } else {
                    mark = self.inlineSetStyle(style, range);
                }
            }

            self.rawCleanup();
            
            return mark;
        },

        
        /**
         * Remove both inline and block styles from a range.
         * Only removes block styles if the range spans multiple lines.
         *
         * @param {Object} [range=current range]
         *
         * @see inlineRemoveStyle(), blockRemoveStyle()
         */
        removeStyles: function(range) {

            var self;

            self = this;
            
            range = range || self.getRange();

            // Remove all inline styles
            self.inlineRemoveStyle('', range);

            // Remove line style if the current range is on multiple lines
            if ((range.from.ch === 0 && range.to.ch === 0) || range.from.line !== range.to.line) {
                self.blockRemoveStyle('', range);
            }
        },

        
        //==================================================
        // INLINE STYLES
        // The following format functions deal with inline styles.
        //==================================================
        
        /**
         * Toggle a class within a range:
         * If all characters within the range are already set to the className, remove the class.
         * If one or more characters within the range are not set to the className, add the class.
         *
         * @param {String} styleKey
         * The format class to toggle (from the styles definition object)
         *
         * @param {Object} [range=current range]
         * The range of positions {from:{line,ch},to:{line,ch}}
         */
        inlineToggleStyle: function(styleKey, range) {

            var mark, self;

            self = this;

            range = range || self.getRange();

            if (self.inlineIsStyle(styleKey, range)) {
                self.inlineRemoveStyle(styleKey, range);
            } else {
                mark = self.inlineSetStyle(styleKey, range);
            }

            return mark;
        },

        
        /**
         * @param {String|Object} style
         * The format to add (from the styles definition object).
         * This can be a String key into the styles object,
         * or it can be the style object itself.
         *
         * @param Object [range=current selection]
         * The range of positions {from,to} 
         */
        inlineSetStyle: function(style, range, options) {
            
            var className, editor, isEmpty, line, mark, markOptions, self, styleObj, $widget, widgetOptions;

            self = this;

            editor = self.codeMirror;
            
            range = range || self.getRange();

            options = options || {};

            if (typeof style === 'string') {
                styleObj = self.styles[style] || {};
            } else {
                styleObj = style;
            }
            className = styleObj.className;
            
            if (styleObj.singleLine && range.from.line !== range.to.line) {
                line = editor.getLine(range.from.line);
                range.to.line = range.from.line;
                range.to.ch = line.length;
            }
            
            markOptions = $.extend({
                className: className,
                inclusiveRight: true,
                addToHistory: true
            }, options);

            
            // Check for special case if no range is defined, we should still let the user
            // select a style to make the style active. Then typing more characters should
            // appear in that style.
            isEmpty = (range.from.line === range.to.line) && (range.from.ch === range.to.ch);
            if (isEmpty) {

                markOptions.addToHistory = false;
                markOptions.clearWhenEmpty = false;
                markOptions.inclusiveLeft = true;
                mark = editor.markText(range.from, range.to, markOptions);
                
            } else {
                
                mark = editor.markText(range.from, range.to, markOptions);
                self.inlineSplitMarkAcrossLines(mark);
            }

            // If this is a set of mutually exclusive styles, clear the other styles
            if (styleObj.clear) {
                $.each(styleObj.clear, function(i, styleKey) {
                    self.inlineRemoveStyle(styleKey, range);
                });
            }

            // If there was a fromHTML filter defined, run it not so additional info can be added to the mark
            if (styleObj.filterFromHTML) {
                styleObj.filterFromHTML(mark);
            }
            
            // Trigger a cursorActivity event so for example toolbar can pick up changes
            CodeMirror.signal(editor, "cursorActivity");

            return mark;
            
        }, // initSetStyle

        
        /**
         * Remove the formatting within a region. You can specify a single class name to remove
         * or remove all the formatting.
         *
         * @param String [styleKey]
         * The format class to remove. Set to empty string to remove all formatting.
         * Also refer to options.includeTrack 
         *
         * @param Object [range=current selection]
         * The range of positions {from,to} 
         *
         * @param Object [options]
         *
         * @param Object [options.deleteText=false]
         * Set to true if you want to also delete the text within each class that is removed.
         *
         * @param String [except]
         * A format class that should not be removed.
         * Use this is you set styleKey to blank (to remove all classes) but you want to
         * keep one specific class. For example, for the "html" class if you want to keep the html class,
         * but remove any other style classes within.
         *
         * @param Object [options.includeTrack=false]
         * Set to true if you want to include the "track changes" classes.
         * Otherwise will ignore those classes.
         *
         * @param Boolean [deleteText=false]
         * Set to true to also delete the text within the mark.
         *
         */
        inlineRemoveStyle: function(styleKey, range, options) {

            var className, deleteText, editor, lineNumber, self, from, to;

            self = this;

            editor = self.codeMirror;
            
            if (styleKey) {
                className = self.styles[styleKey].className;
            }
            
            options = options || {};
            deleteText = options.deleteText;
            
            range = range || self.getRange();

            from = range.from;
            to = range.to;

            lineNumber = from.line;
            
            // Before beginning, clean up the CodeMirror marks
            // to make sure they do not span across separate lines.
            self.inlineCleanup();

            editor.eachLine(from.line, to.line + 1, function(line) {

                var fromCh, toCh, marks;

                // Get the character ranges to search within this line.
                // If we're not on the first line, start at the beginning of the line.
                // If we're not on the last line, stop at the end of the line.
                fromCh = (lineNumber === from.line) ? from.ch : 0;
                toCh = (lineNumber === to.line) ? to.ch : line.text.length;

                // Loop through all the marks defined on this line
                marks = line.markedSpans || [];
                marks.forEach(function(mark) {

                    var from, markerOpts, markerOptsNotInclusive, matchesClass, outsideOfSelection, selectionStartsBefore, selectionEndsAfter, styleObj, to;
                    
                    // Check if we should remove the class
                    matchesClass = false;
                    if (className) {
                        matchesClass = Boolean(mark.marker.className === className);
                    } else {
                        styleObj = self.classes[mark.marker.className] || {};
                        
                        // Do not remove the track changes classes unless specifically named
                        matchesClass = Boolean(options.includeTrack || styleObj.internal !== true);

                        // Do not remove the "except" class if it was specified
                        if (mark.marker.className === options.except) {
                            matchesClass = false;
                        }
                    }
                    
                    if (!matchesClass) {
                        return;
                    }

                    markerOpts = mark.marker;
                    markerOpts.addToHistory = true;

                    markerOptsNotInclusive = $.extend(true, {}, markerOpts);
                    markerOptsNotInclusive.inclusiveLeft = markerOptsNotInclusive.inclusiveRight = false;
                    
                    if (markerOpts.type === 'bookmark') {
                        return;
                    }

                    // Figure out the range for this mark
                    to = mark.to;
                    from = mark.from;
                    if (mark.to === null) {
                        to = line.text.length;
                    }
                    if (mark.from === null) {
                        from = 0;
                    }

                    // Determine if this mark is outside the selected range
                    outsideOfSelection = fromCh > to || toCh < from;
                    if (outsideOfSelection) {
                        return;
                    }

                    selectionStartsBefore = fromCh <= from;
                    selectionEndsAfter = toCh >= to;

                    if (selectionStartsBefore && selectionEndsAfter) {
                        
                        // The range completely surrounds the mark.

                        // This is some text
                        //      mmmmmmm      <-- mark
                        //    rrrrrrrrrrr    <-- range
                        //                   <-- no new mark
                        //      xxxxxxx      <-- text to delete (if deleteText is true)


                        if (deleteText) {
                            mark.marker.shouldDeleteText = true;
                        }
                        
                        // Clear the mark later

                    } else if (selectionStartsBefore && !selectionEndsAfter) {
                        
                        // The range starts before this mark, but it ends within the mark.
                        // Create a new mark to represent the part of the mark that is not being removed.
                        // The original mark will be deleted later.
                        //
                        // This is some text
                        //      mmmmmmm      <-- mark
                        // rrrrrrrr          <-- range
                        //         nnnn      <-- new mark
                        //      xxx          <-- text to delete (if deleteText is true)
                        
                        // Create a new marker for the text that should remain styled
                        editor.markText(
                            { line: lineNumber, ch: toCh },
                            { line: lineNumber, ch: to },
                            markerOpts
                        );

                        if (deleteText) {
                            // Create a marker for the text that will be deleted
                            // It should be the part of the marked text that is outside the range
                            editor.markText(
                                { line: lineNumber, ch: from },
                                { line: lineNumber, ch: toCh },
                                markerOpts
                            ).shouldDeleteText = true;
                        }
                        
                        // Clear the original mark later
                        
                    } else if (!selectionStartsBefore && selectionEndsAfter) {
                        
                        // The range starts within this mark, but it ends after the mark.
                        // Create a new mark to represent the part of the mark that is not being removed.
                        // The original mark will be deleted later.
                        //
                        // This is some text
                        //      mmmmmmm      <-- marked
                        //        rrrrrrrrrr <-- range
                        //      nn           <-- new mark
                        //        xxxxx      <-- text to delete (if deleteText is true)

                        editor.markText(
                            { line: lineNumber, ch: from },
                            { line: lineNumber, ch: fromCh },
                            markerOptsNotInclusive
                        );

                        if (deleteText) {
                            // Create a marker for the text that will be deleted
                            // It should be the part of the marked text that is outside the range
                            editor.markText(
                                { line: lineNumber, ch: fromCh },
                                { line: lineNumber, ch: to },
                                markerOpts
                            ).shouldDeleteText = true;
                        }

                        // Clear the original mark later
                        
                    } else {

                        // The range is entirely inside the marker.
                        // Create two new marks - one before the range, and one after the range.
                        //
                        // This is some text
                        //      mmmmmmm      <-- marked
                        //        rrr        <-- range
                        //      nn   nn      <-- new marks
                        //        xxx        <-- text to delete (if deleteText is true)
                        
                        editor.markText(
                            { line: lineNumber, ch: toCh },
                            { line: lineNumber, ch: to },
                            markerOpts
                        );

                        editor.markText(
                            { line: lineNumber, ch: from },
                            { line: lineNumber, ch: fromCh },
                            markerOptsNotInclusive
                        );
                        
                        if (deleteText) {
                            // Create a marker for the text that will be deleted
                            // It should be the part of the marked text that is outside the range
                            editor.markText(
                                { line: lineNumber, ch: fromCh },
                                { line: lineNumber, ch: toCh },
                                markerOpts
                            ).shouldDeleteText = true;
                        }

                        // Clear the original mark later
                    }

                    // Set a flag on the marker object so we can find it later for removal
                    mark.marker.shouldRemove = true;
                });

                // Go to the next line
                lineNumber++;
                
            });

            // Loop through all the marks and remove the ones that were marked
            editor.getAllMarks().forEach(function(mark) {

                var position;

                if (deleteText && mark.shouldDeleteText) {
                    position = mark.find();
                    if (position) {
                        editor.replaceRange('', position.from, position.to, '+brightspotFormatRemoveClass');
                    }
                }
                if (mark.shouldRemove) {
                    mark.clear();
                }
            });

            // Trigger a cursor activity event so the toolbar can update
            CodeMirror.signal(editor, "cursorActivity");
        },


        /**
         * Given a styles and a cursor position, removes the style that surrounds the cursor position.
         *
         * For example, if your cursor "|" is within an italic styled area:
         * this is <i>it|alic<i> text
         *
         * Then this function will remove the italic styling and the text within, leaving you with:
         * this is  text
         */
        inlineRemoveStyledText: function(styleKey, range) {
            
            var mark, pos, self, styles;

            self = this;
            
            mark = self.inlineGetMark(styleKey, range);
            if (mark) {
                
                pos = mark.find();
            
                // Delete the text within the mark
                self.codeMirror.replaceRange('', pos.from, pos.to);

                // Delete the mark
                mark.clear();
            }
        },

        
        /**
         * Determines if ALL characters in the range have a style.
         *
         * @param String className
         * The format class to add.
         *
         * @param Object [range=current selection]
         * The range of positions {from,to} 
         *
         * @returns Boolean
         * True if all charcters in the range are styled with className.
         */
        inlineIsStyle: function(styleKey, range) {
            
            var classes, className, self, styles;

            self = this;

            // Check if className is a key into our styles object
            className = self.styles[styleKey].className;
            
            range = range || self.getRange();

            styles = self.inlineGetStyles(range);
            
            return Boolean(styles[styleKey]);
        },


        /**
         * Get the mark for a particular style within a range.
         *
         * @returns {Object} mark
         * The mark object for the first style found within the range,
         * or undefined if that style is not in the range.
         */
        inlineGetMark: function(styleKey, range) {

            var className, editor, matchingMark, self;

            self = this;

            editor = self.codeMirror;
            
            // Check if className is a key into our styles object
            className = self.styles[styleKey].className;
            
            range = range || self.getRange();

            $.each(editor.findMarks(range.from, range.to), function(i, mark) {
                if (mark.className === className) {
                    matchingMark = mark;
                    return false; // stop the loop
                }
            });

            return matchingMark;
        },

        
        /**
         * Determines if ANY character in the range has the className.
         *
         * @param String className
         * The format class to add.
         *
         * @param Object [range=current selection]
         * The range of positions {from,to} 
         *
         * @returns Boolean
         * True if all charcters in the range are styled with className.
         */
        inlineHasStyle: function(styleKey, range) {
            
            var self, styles, value;

            self = this;

            range = range || self.getRange();

            styles = self.inlineGetStyles(range);
            value = styles[styleKey];
            return Boolean(value === true || value === false);
        },

        
        /**
         * Returns a list of all styles that are set for the characters in a range.
         * If a style is defined for ALL characters in the range, it will receive a value of true.
         * If a style is not defined for ALL characters in the range, it will receive a value of false.
         *
         * @param Object [range=current selection]
         * The range of positions {from,to} 
         *
         * @returns Object
         * An object that contains all the styles that are set for the range.
         * If the style is defined for ALL the characters within the range,
         * then the value will be true. If the style is defined for some characters
         * in the range but not all the characters, then the value will be false.
         * If a style is not defined at all within the range, then it will not be set in the return object (undefined).
         *
         * For example, if the range of text has every character bolded, but only one character italic,
         * the return value would be as follows:
         * {bold:true, italic:false}
         */
        inlineGetStyles: function(range) {
            
            var classes, classMap, isClass, isCursor, editor, lineNumber, self, styles, lineStarting;

            self = this;
            editor = self.codeMirror;
            range = range || self.getRange();
            lineNumber = range.from.line;

            styles = {};
            classes = {};
            
            isClass = true;
            isCursor = Boolean(range.from.line === range.to.line && range.from.ch === range.to.ch);

            editor.eachLine(range.from.line, range.to.line + 1, function(line) {

                var charTo, charNumber, charFrom, once, isRange;
                
                charFrom = (lineNumber === range.from.line) ? range.from.ch : 0;
                charTo = (lineNumber === range.to.line) ? range.to.ch : line.text.length;

                isRange = Boolean(charFrom !== charTo);
                
                // Loop through each character in the range
                for (charNumber = charFrom; charNumber <= charTo; charNumber++) {

                    var classesForChar, marks;
                    
                    classesForChar = {};

                    // Get all of the marks for this character and get a list of the class names
                    marks = editor.findMarksAt({ line: lineNumber, ch: charNumber });

                    marks.forEach(function(mark) {
                        
                        var markPosition;
                        
                        if (mark.className) {

                            markPosition = mark.find();

                            // We need to check a couple special cases.
                            //
                            // If you are not selecting a range of characters but instead are looking at a cursor,
                            // CodeMirror still sends us the marks that are next to the position of the cursor.
                            //
                            // Marks can have an "inclusiveLeft" and "inclusiveRight" property, which means to extend the mark
                            // to the left or the right when text is added on that side.
                            //
                            // If the mark is defined to the right of the cursor, then we only include the classname if inclusiveLeft is set.
                            // If the mark is defined to the left of the cursor, then we only include the classname if inclusiveRight is set.
                            
                            if (isCursor && markPosition.from.line === lineNumber && markPosition.from.ch === charNumber && !mark.inclusiveLeft) {

                                // Don't add this to the classes if we are on the left side of the range when inclusiveLeft is not set
                                
                            } else if (isCursor && markPosition.to.line === lineNumber && markPosition.to.ch === charNumber && !mark.inclusiveRight) {
                                
                                // Don't add this to the classes if we are on the right side of the range when inclusiveRight is not set

                            } else {

                                // Add this class to the list of classes found on this character position
                                classesForChar[mark.className] = true;
                            }
                        }
                    });

                    // If this is the first character, save the list of classes so we can compare against all the other characters
                    if (lineNumber === range.from.line && charNumber === range.from.ch) {
                        classes = $.extend({}, classesForChar);
                    } else {

                        // We are not on the first character.
                        // Check all the previous classes we found, and if they were not also found on the current character,
                        // then mark the class false (to indicate the class was found but is not on ALL characters in the range)

                        // We need to check for one special case - if user characters to the end of the line:
                        //  xxxx[XXX\n]
                        //
                        // Then technically the CodeMirror selection goes to the next line:
                        // xxxx[XXX
                        // ]
                        //
                        // So in that case we end up looking at the next line, which does not have the className.
                        //
                        // To prevent this from interfering with our selection, don't mark the classname as false if we're
                        // looking at a cursor position rather than a range of charcters.

                        if (isRange) {

                            $.each(classes, function(className, value) {
                                if (!classesForChar[className]) {
                                    classes[className] = false;
                                }
                            });
                        }

                        // For any additional classes we found (that were not already in the list)
                        // add them to the list but set value false
                        $.each(classesForChar, function(className) {
                            if (!classes[className]) {
                                classes[className] = false;
                            }
                        });
                    }
                }

                lineNumber++;
            });
            
            // We have a list of class names used within the rich text editor (like 'rte2-style-bold')
            // but we really want the abstracted style names (like 'bold').
            // Convert the class name into the style name.
            $.each(classes, function(className, value) {
                var styleKey, styleObj;
                styleObj = self.classes[className];
                if (styleObj) {
                    styles[styleObj.key] = value;
                }
            });
            
            return styles;
        }, // inlineGetStyles


        /**
         * Find all the inline styles that match className and change them into a "collapsed" region.
         * If user clicks on the region or moves the cursor into the region it will automatically expand again.
         */
        inlineCollapse: function(styleKey, range) {

            var className, editor, self;

            self = this;
            editor = self.codeMirror;

            // Check if className is a key into our styles object
            className = self.styles[styleKey].className;
            
            range = range || self.getRange();
            
            // Find the marks within the range that match the classname
            $.each(editor.findMarks(range.from, range.to), function(i, mark) {

                var markCollapsed, markPosition, widgetOptions;

                // Skip this mark if it is not the desired classname
                if (mark.className !== className) {
                    return;
                }

                markPosition = mark.find();
                
                // Create a codemirror "widget" that will replace the mark
                $widget = $('<span/>', {
                    'class': self.styles.collapsed.className,
                    text: '\u2026' // ellipsis character
                });

                // Replace the mark with the collapse widget
                widgetOptions = {
                    inclusiveRight: false,
                    inclusiveLeft: false,
                    replacedWith: $widget[0],
                    clearOnEnter: true // If the cursor enters the collapsed region then uncollapse it
                };

                // Create the collapsed mark
                markCollapsed = editor.markText(markPosition.from, markPosition.to, widgetOptions);

                // If user clicks the widget then uncollapse it
                $widget.on('click', function() {
                    // Use the closure variable "markCollapsed" to clear the mark that we created above
                    markCollapsed.clear();
                    return false;
                });
            });
        }, // inlineCollapse

        
        /**
         * CodeMirror makes marks across line boundaries.
         * This function steps through all marks and splits up the styles
         * so they do not cross the end of the line.
         * This allows other functions to operate correctly.
         */
        inlineCleanup: function() {

            var doc, editor, marks, marksByClassName, self;

            self = this;
            editor = self.codeMirror;
            doc = editor.getDoc();

            // Loop through all the marks in the document,
            // find the ones that span across lines and split them
            $.each(editor.getAllMarks(), function(i, mark) {
                self.inlineSplitMarkAcrossLines(mark);
            });

            self.inlineCombineAdjacentMarks();
        },


        /**
         * Inside any "raw" HTML mark, remove all other marks.
         */
        rawCleanup: function() {
            
            var editor, self;

            self = this;
            editor = self.codeMirror;
            
            $.each(editor.getAllMarks(), function(i, mark) {

                var pos, styleObj, from, to;
                
                // Is this a "raw" mark?
                styleObj = self.classes[mark.className] || {};
                if (styleObj.raw) {

                    // Get the start and end positions for this mark
                    pos = mark.find() || {};
                    if (!pos.from) {
                        return;
                    }
                    
                    from = pos.from;
                    to = pos.to;

                    // Clear other styles
                    self.inlineRemoveStyle('', {from:from, to:to}, {includeTrack:true, except:mark.className});
                }
                
            });
        },
        

        /**
         * CodeMirror makes styles across line boundaries.
         * This function steps through all lines and splits up the styles
         * so they do not cross the end of the line.
         * This allows other functions to operate more efficiently.
         */
        inlineSplitMarkAcrossLines: function(mark) {

            var editor, to, lineNumber, pos, self, from;

            self = this;
            editor = self.codeMirror;

            mark = mark.marker ? mark.marker : mark;
            
            // Get the start and end positions for this mark
            pos = mark.find();
            if (!pos.from) {
                return;
            }
            
            from = pos.from;
            to = pos.to;

            // Does this mark span multiple lines?
            if (to.line !== from.line) {

                // Loop through the lines that this marker spans and create a marker for each line
                for (lineNumber = from.line; lineNumber <= to.line; lineNumber++) {

                    var fromCh, newMark, toCh;
                    
                    fromCh = (lineNumber === from.line) ? from.ch : 0;
                    toCh = (lineNumber === to.line) ? to.ch : editor.getLine(lineNumber).length;

                    
                    // Create a new mark on this line only
                    newMark = editor.markText(
                        { line: lineNumber, ch: fromCh },
                        { line: lineNumber, ch: toCh },
                        mark
                    );

                    // Copy any additional attributes that were attached to the old mark
                    newMark.attributes = mark.attributes;
                }

                // Remove the old mark that went across multiple lines
                mark.clear();
            }
        },


        /**
         * Combine all marks that are overlapping or adjacent.
         * Note this assumes that the marks do not span across multiple lines.
         */
        inlineCombineAdjacentMarks: function() {

            var editor, marks, self;

            self = this;
            editor = self.codeMirror;
            
            // Combine adjacent marks
            // Note this assumes that marks do not span across lines
            
            // First get a list of the marks
            marks = editor.getAllMarks();

            // Remove any bookmarks (which are used for enhancements and markers)
            marks = $.map(marks, function(mark, i) {
                
                if (mark.type === 'bookmark') {
                    return undefined;
                } else {
                    return mark;
                }
            });
            
            // Sort the marks in order of position
            marks = marks.sort(function(a, b){
                
                var posA, posB;

                posA = a.find();
                posB = b.find();

                if (posA.from.line === posB.from.line) {
                    // If marks are on same line sort by the character number
                    return posA.from.ch - posB.from.ch;
                } else {
                    // If marks are on differnt lines sort by the line number
                    return posA.from.line - posB.from.line;
                }
            });

            // Next group the marks by class name
            // This will give us a list of classnames, and each one will contain a list of marks in order
            marksByClassName = {};
            $.each(marks, function(i, mark) {
                var className;

                className = mark.className;

                if (!marksByClassName[className]) {
                    marksByClassName[className] = [];
                }
                marksByClassName[className].push(mark);
            });

            // Next go through all the classes, and combine the marks
            $.each(marksByClassName, function(className, marks) {

                var i, mark, markNext, markNew, pos, posNext;

                i = 0;
                while (marks[i]) {

                    mark = marks[i];
                    markNext = marks[i + 1];

                    if (!markNext) {
                        break;
                    }

                    pos = mark.find();
                    posNext = markNext.find();

                    if (pos.from.line === posNext.from.line) {

                        if (posNext.from.ch <= pos.to.ch) {

                            // The marks are overlapping or adjacent, so combine them into a new mark
                            markNew = editor.markText(
                                { line: pos.from.line, ch: pos.from.ch },
                                { line: pos.from.line, ch: Math.max(pos.to.ch, posNext.to.ch) },
                                mark
                            );

                            // Clear the original two marks
                            mark.clear();
                            markNext.clear();

                            // Replace markNext with markNew so the next loop will start with the new mark
                            // and we can check to see if the following mark needs to be combined again
                            marks[i + 1] = markNew;
                            
                        }
                    }

                    i++;
                }
            });
        },

        
        //==================================================
        // BlOCK STYLES
        // The following line functions deal with block styles that apply to a single line.
        //==================================================
        
        /**
         * Toggle the line class within a range:
         * If all lines within the range are already set to the className, remove the class.
         * If one or more lines within the range are not set to the className, add the class.
         *
         * @param String styleKey
         * The line style to toggle.
         *
         * @param Object [range]
         */
        blockToggleStyle: function(styleKey, range) {
            
            var mark, self;

            self = this;

            range = range || self.getRange();
            
            if (self.blockIsStyle(styleKey, range)) {
                self.blockRemoveStyle(styleKey, range);
            } else {
                mark = self.blockSetStyle(styleKey, range);
            }
            
            return mark;
        },

        
        /**
         * @param String classname
         *
         * @param {String|Object} style
         * The line style to set.
         *
         * @param Object [range=current selection]
         * The range of positions {from,to}.
         */
        blockSetStyle: function(style, range) {

            var className, editor, lineNumber, self, styleObj;

            self = this;
            editor = self.codeMirror;
            range = range || self.getRange();

            if (typeof style === 'string') {
                styleObj = self.styles[style];
            } else {
                styleObj = style;
            }
            className = styleObj.className;
            
            for (lineNumber = range.from.line; lineNumber <= range.to.line; lineNumber++) {
                editor.addLineClass(lineNumber, 'text', className);
            }

            // If this is a set of mutually exclusive styles, clear the other styles
            if (styleObj.clear) {
                $.each(styleObj.clear, function(i, styleKey) {
                    self.blockRemoveStyle(styleKey, range);
                });
            }

            // Refresh the editor display since our line classes
            // might have padding that messes with the cursor position
            editor.refresh();
        },

        
        /**
         * Remove the line class for a range.
         *
         * @param String [className]
         * The line style to remove. Set to empty string to remove all line styles.
         *
         * @param Object [range=current selection]
         * The range of positions {from,to} 
         */
        blockRemoveStyle: function(styleKey, range) {

            var className, classNames, classes, editor, line, lineNumber, self;

            self = this;
            editor = self.codeMirror;
            range = range || self.getRange();

            if (styleKey) {
                className = self.styles[styleKey].className;
            }

            for (lineNumber = range.from.line; lineNumber <= range.to.line; lineNumber++) {
                
                if (className) {
                    
                    // Remove a single class from the line
                    editor.removeLineClass(lineNumber, 'text', className);
                    
                } else {
                    
                    // Remove all classes from the line
                    line = editor.getLineHandle(lineNumber);
                    $.each((line.textClass || '').split(' '), function(i, className) {
                        editor.removeLineClass(lineNumber, 'text', className);
                    });
                }
            }
            
            // Refresh the editor display since our line classes
            // might have padding that messes with the cursor position
            editor.refresh();
        },
        

        
        /**
         * Determines if all lines in a range have the specified class.
         */
        blockIsStyle: function(styleKey, range) {

            var classes, editor, self, styles;

            self = this;
            editor = self.codeMirror;

            styles = self.blockGetStyles(range);
            return Boolean(styles[styleKey]);
        },


        /**
         * Return a list of all classes that are selected for all lines within a range.
         * If a class is set for one line but not others in the range, it is *not* returned.
         *
         * @param Object [range=current selection]
         */
        blockGetStyles: function(range) {
            
            var classes, editor, self, styles;

            self = this;
            editor = self.codeMirror;
            
            range = range || self.getRange();

            // Loop through all lines in the range
            editor.eachLine(range.from.line, range.to.line + 1, function(line) {

                var classNames, classesLine;

                // There is at least one classname on this line
                // Split the class string into an array of individual class names and store in an object for easy lookup
                classNames = line.textClass || '';
                classesLine = {};
                $.each(classNames.split(' '), function(i, className) {
                    if (className) {
                        classesLine[className] = true;
                    }
                });

                // Check if we are on the first line
                if (!classes) {

                    // We are on the first line so add all classes to the list
                    classes = $.extend({}, classesLine);
                    
                } else {

                    // We are not on the first line, so remove any class from the list
                    // if it is not also on the current line
                    $.each(classes, function(className) {
                        if (!classesLine[className]) {
                            classes[className] = false;
                        }
                    });

                    // For any additional classes we found (that were not already in the list)
                    // add them to the list but set value false
                    $.each(classesLine, function(className) {
                        if (!classes[className]) {
                            classes[className] = false;
                        }
                    });
                }
            });

            // We have a list of class names used within the rich text editor (like 'rte2-ol')
            // but we really want the abstracted style names (like 'ol').
            // Convert the class name into the style name.
            styles = {};
            if (classes) {
                $.each(classes, function(className, value) {
                    var styleKey, styleObj;
                    styleObj = self.classes[className];
                    if (styleObj) {
                        styles[styleObj.key] = value;
                    }
                });
            }

            return styles;
        },

        
        /**
         * Returns the list type for a line.
         *
         * So what is a list? For our purposes, it is an item in the styles defenition object
         * that has an "elementContainer" parameter.
         *
         * @param Number lineNumber
         * The line number to check.
         *
         * @returns String
         * The key from the style definition object.
         * For example:
         * '' = not a list
         * 'ul' = unordered list item
         * 'ol' = ordered list item
         */
        blockGetListType: function(lineNumber) {

            var classNames, editor, line, lineInfo, listType, self;

            self = this;
            editor = self.codeMirror;

            listType = '';
            
            line = editor.getLineHandle(lineNumber);
            lineInfo = editor.lineInfo(line);
            classNames = lineInfo.textClass || "";

            $.each(classNames.split(' '), function(i, className) {

                var styleObj;

                styleObj = self.classes[className];
                if (styleObj && styleObj.elementContainer) {
                    listType = styleObj.key;
                    return false;
                }
            });

            return listType;
        },


        //--------------------------------------------------
        // Enhancements
        // An enhancement is a block of external content that can be added to the editor.
        //--------------------------------------------------

        /**
         * Initialize internal storage for enhancements.
         */
        enhancementInit: function() {
            
            var self = this;
            
            // Unique ID to use for enchancments.
            self.enhancementId = 0;
            
            // Internal storage for enhancements that have been added.
            // CodeMirror doesn't seem to have a way to get a list of enhancements,
            // so we'll have to remember them as we create them.
            self.enhancementCache = {};
        },
        
        
        /**
         * Add an enhancement into the editor.
         * Note if you change the size of the enhancement content then you must call the refresh() method
         * to update the editor display, or the cursor positions will not be accurate.
         *
         * @param Element|jQuery content
         *
         * @param Number [lineNumber=starting line of the current range]
         * The line number to add the enhancement. The enhancement is always placed at the start of the line.
         *
         * @param Object [options]
         * @param Object [options.block=false]
         * @param Object [options.above=false]
         * @param Function [options.toHTML]
         * Function to return HTML content to be placed at the point of the enhancement.
         * If not provided then the enhancement will not appear in the output.
         *
         * @returns Object
         * The "mark" object that can be used later to move, remove, or update the enhancment content.
         *
         * @example
         * $content = $('<div>My Enhancement Content</div>');
         * rte.enhancementAdd($content);
         */
        enhancementAdd: function(content, lineNumber, options) {

            var editor, mark, range, self, widgetOptions;

            self = this;
            editor = self.codeMirror;

            options = options || {};
            
            // In case someone passes a jQuery object, convert it to a DOM element
            content = $(content)[0];

            if (lineNumber === null || typeof lineNumber === 'undefined') {
                range = self.getRange();
                lineNumber = range.from.line;
            }

            // Replace the mark with the collapse widget
            widgetOptions = {
                widget: content
            };

            if (options.block) {
                
                mark = editor.addLineWidget(lineNumber, content, {above: true});

                mark.deleteLineFunction = function(){

                    var content, $content;

                    content = self.enhancementGetContent(mark);
                    $content = $(content).detach();
                    self.enhancementRemove(mark);
                    
                    setTimeout(function(){
                        self.enhancementAdd($content[0], null, options);
                    }, 100);
                    
                };
                
                // If the line is deleted we don't want to delete the enhancement!
                mark.line.on('delete', mark.deleteLineFunction);

            } else {
                mark = editor.setBookmark({line:lineNumber, ch:0}, widgetOptions);
            }

            // Save the options we used along with the mark so it can be used later to move the mark
            // and to call the toHTML function.
            mark.options = options;

            // Save the mark onto the content element so it can be access later
            // using the enhancementGetMark(el) function.
            // This can be used for example to implement a toolbar within the enhancement
            // since the toolbar might need access to the mark for changing the enhancement settings.
            $(content).data('enhancementMark', mark);
            
            // Save the mark in an internal cache so we can use it later to output content.
            mark.options.id = self.enhancementId++;
            self.enhancementCache[ mark.options.id ] = mark;
            
            // Small delay before refreshing the editor to prevent cursor problems
            setTimeout(function(){
                self.refresh();
                mark.changed();
            }, 100);
            
            return mark;
        },

        
        /**
         * Move an enhancement block up or down a line.
         *
         * @param Object mark
         * The mark that was returned by the enhancementAdd() function.
         *
         * @param Number lineDelta
         * Direction to move the mark:
         * -1 = move the mark up one line
         * +1 = move the mark down one line
         *
         * @return Object
         * Returns a new mark that contains the enhancement content.
         */
        enhancementMove: function(mark, lineDelta) {

            var content, $content, editor, lineLength, lineNumber, lineMax, position, self;

            self = this;
            editor = self.codeMirror;

            // Get the options we saved previously so we can create a mark with the same options
            options = mark.options;
            
            lineMax = editor.lineCount() - 1;
            lineNumber = self.enhancementGetLineNumber(mark) + lineDelta;

            if (lineNumber < 0) {
                return mark;
            }
            
            if (lineNumber > lineMax) {
                
                // Add another line to the end of the editor
                lineLength = editor.getLine(lineMax).length;
                editor.replaceRange('\n', {line:lineMax, ch:lineLength});
                
            }

            // Depending on the type of mark that was created, the content is stored differently
            content = self.enhancementGetContent(mark);
            $content = $(content).detach();

            self.enhancementRemove(mark);
            
            mark = self.enhancementAdd($content[0], lineNumber, options);
            
            return mark;
        },

        
        /**
         * Removes an enhancement.
         *
         * @param Object mark
         * The mark that was returned when you called enhancementAdd().
         */
        enhancementRemove: function(mark) {
            var self;
            self = this;
            delete self.enhancementCache[ mark.options.id ];
            if (mark.deleteLineFunction) {
                mark.line.off('delete', mark.deleteLineFunction);
            }
            mark.clear();
            self.codeMirror.removeLineWidget(mark);
        },


        /**
         * Given a mark object created from enhancementAdd() this function
         * returns the DOM element for the content.
         *
         * @param Object mark
         * The mark that was returned when you called enhancementAdd.
         *
         * @returns Element
         * The DOM element for the enhancement content.
         */
        enhancementGetContent: function(mark) {

            // Get the content element for the mark depending on the type of mark
            return mark.node || mark.replacedWith;
        },


        /**
         * @returns Number
         * The line number of the mark.
         */
        enhancementGetLineNumber: function(mark) {
            
            var lineNumber, position;

            if (mark.line) {
                lineNumber = mark.line.lineNo() || 0;
            } else if (mark.find) {
                position = mark.find();
                lineNumber = position.line;
            } else {
                lineNumber = 0;
            }
            
            return lineNumber;
        },

        
        /**
         * Turn the enhancement into an inline element that is at the beginning of a line.
         * You must do this if you plan to float the enhancment left or right.
         * 
         * @param Object mark
         * The mark that was returned when you called enhancementAdd().
         */
        enhancementSetInline: function(mark) {
            
            var content, lineNumber, self;

            self = this;

            lineNumber = self.enhancementGetLineNumber(mark);
            
            content = self.enhancementGetContent(mark);
            $content = $(content).detach();

            self.enhancementRemove(mark);
            
            return self.enhancementAdd($content[0], lineNumber);
        },

        
        /**
         * Turn the enhancement into a block element that goes between two lines.
         *
         * @param Object mark
         * The mark that was returned when you called enhancementAdd().
         *
         * @returns Object
         * The new mark that was created.
         */
        enhancementSetBlock: function(mark, options) {

            var content, lineNumber, self;

            self = this;

            options = options || {};
            
            lineNumber = self.enhancementGetLineNumber(mark);
            
            content = self.enhancementGetContent(mark);
            $content = $(content).detach();

            self.enhancementRemove(mark);
            
            return self.enhancementAdd($content[0], lineNumber, $.extend({}, options, {block:true}));
        },


        /**
         * When an enhancement is imported by the toHTML() function, this function
         * is called. You can override this function to provide additional functionality
         * for your enhancements.
         *
         * If you override this function you are responsible for calling enhancementAdd()
         * to actually create the ehancement in the editor.
         *
         * @param jQuery $content
         * A jQuery object containing the enhancement content from the HTML.
         *
         * @param Number line
         * The line number where the enhancement was found.
         */
        enhancementFromHTML: function($content, line) {
            var self;
            self = this;
            self.enhancementAdd($content, line, {above:true, toHTML: function(){
                return $content.html();
            }});
        },


        /**
         * Given the content element within the enhancement, this function returns the
         * mark for the enhancement.
         *
         * @param {Element} el
         * This must be the element that was passed in to the enhancementAdd() function.
         *
         * @return {Object} mark
         * The mark object that can be used to modify the enhancement.
         */
        enhancementGetMark: function(el) {
            return $(el).data('enhancementMark');
        },

        
        //--------------------------------------------------
        // Track Changes
        //--------------------------------------------------
        
        /**
         * Set up event handlers for tracking changes.
         */
        trackInit: function() {
            
            var editor, self;

            self = this;
            
            editor = self.codeMirror;

            // Monitor the "beforeChange" event so we can track changes
            editor.on('beforeChange', function(instance, changeObj) {
                self.trackBeforeChange(changeObj);
            });

            // Update the display to show current state of tracking
            self.trackDisplayUpdate();
        },

        
        /**
         * Turn track changes on or off.
         */
        trackSet: function(on) {
            var self;
            self = this;
            self.trackChanges = Boolean(on);
        },

        
        /**
         * Toggle track changes (on or off)
         */
        trackToggle: function() {
            var self;
            self = this;
            self.trackSet( !self.trackIsOn() );
        },

        
        /**
         * Determine if track changes is currently on.
         *
         * @returns Boolean
         * True if track changes is on.
         */
        trackIsOn: function() {
            var self;
            self = this;
            return Boolean(self.trackChanges);
        },


        /**
         * Event handler for codeMirror to implement track changes.
         * When new text is added mark it as inserted.
         * When text deleted, mark it as deleted instead of actually deleting it.
         * This code handles a lot of special cases such as selecting a region that
         * already has track changes marks, then pasting new content on top, etc.
         *
         * @param Object changeObj
         * The CodeMirror change object returned by the "beforeChange" event.
         */
        trackBeforeChange: function(changeObj) {
            
            var classes, editor, charPosition, cursorPosition, isEmpty, self, textOriginal, textNew;
            
            self = this;
            editor = self.codeMirror;

            // Check if track changes is on.
            // Note - even if track changes is off, there might be tracking marks already on the page,
            // so there is code later (in the else clause) for dealing with that.
            if (self.trackIsOn()) {

                // Get the cursor position because when we delete text 
                cursorPosition = editor.getCursor('anchor');

                switch (changeObj.origin) {

                case '+delete':
                case 'cut':

                    // If we're deleting just a line just let it be deleted
                    // Because we don't have a good way to accept or reject a blank line
                    textOriginal = editor.getRange(changeObj.from, changeObj.to);
                    if (textOriginal === '\n') {
                        return;
                    }
                    
                    // Do not actually delete the text because we will mark it instead
                    changeObj.cancel();

                    // Move the cursor to where it was going if the text had been deleted
                    if (cursorPosition.line === changeObj.from.line && cursorPosition.ch === changeObj.from.ch) {
                        editor.setCursor(changeObj.to);
                    } else {
                        editor.setCursor(changeObj.from);
                    }

                    self.trackMarkDeleted({from: changeObj.from, to:changeObj.to});
                    
                    break;

                case '+input':
                case 'paste':

                    // Are we inserting at a cursor, or replacing a range?
                    if (changeObj.from.line === changeObj.to.line && changeObj.from.ch === changeObj.to.ch) {
                        
                        // We are inserting new text at a cursor position,
                        // so we don't have to worry about replacing existing text

                        // If we are inserting just a line let it be inserted with no marking changes
                        // Because we don't have a good way to accept or reject a blank line
                        isEmpty = Boolean(changeObj.text.join('') === '');
                        if (isEmpty) {
                            return;
                        }

                        // Mark the range as inserted (before we let the insertion occur)
                        // Then when text is replaced it will already be in an area marked as new
                        self.inlineSetStyle('trackInsert', {from: changeObj.from, to:changeObj.to});

                        // In case we are inserting inside a deleted block,
                        // make sure the new text we are adding is not also marked as deleted
                        self.inlineRemoveStyle('trackDelete', {from: changeObj.from, to:changeObj.to});

                    } else {

                        // We are replacing existing text, so we need to handle cases where the text to be replaced
                        // already has things that we are tracking as deleted or inserted.

                        // Do not do the paste or insert
                        changeObj.cancel();
                        
                        // Mark the whole range as "deleted" for track changes
                        // Note there might be some regions inside this that are marked as "inserted" but we'll deal with that below
                        self.trackMarkDeleted({from: changeObj.from, to:changeObj.to});

                        // Delete text within the range if it was previously marked as a new insertion
                        // Note: after doing this, the range might not be valid since we might have removed characters within it
                        self.inlineRemoveStyle('trackInsert', {from:changeObj.to, to:changeObj.to}, {deleteText:true});

                        // Insert the new text...
                        
                        // First remove the "delete" mark at the point where we are insering to make sure the new text is not also marked as deleted
                        self.inlineRemoveStyle('trackDelete', {from: changeObj.from, to:changeObj.from});
                        
                        // Then add a mark so the inserted text will be marked as an insert
                        self.inlineSetStyle('trackInsert', {from: changeObj.from, to:changeObj.from}, {inclusiveLeft:true});

                        // Finally insert the text at the starting point (before the other text in the range that was marked deleted)
                        // Note we add at the front because we're not sure if the end is valid because we might have removed some text
                        editor.replaceRange(changeObj.text, changeObj.from, undefined, '+brightspotTrackInsert');
                        
                    }
                    
                    break;
                }

            } else {
                
                // Track change is NOT currently active
                // HOWEVER we must make sure any inserted text does not expand anything currently marked as a change
                // because the changes do not go away when you turn off 

                classes = self.inlineGetStyles({from: changeObj.from, to: changeObj.to});
                if ('trackInsert' in classes || 'trackDelete' in classes) {
                    
                    switch (changeObj.origin) {

                    case '+delete':
                    case 'cut':
                    case '+input':
                    case 'paste':

                        // Check if we are inserting text at a single point (rather than overwriting a range of text)
                        if (changeObj.from.line === changeObj.to.line && changeObj.from.ch === changeObj.to.ch) {
                            
                            // In the case of inserting new content at a single point, if we are inside a tracked change,
                            // we need to ensure the new text is not also marked as an insertion or deletion.
                            // Before inserting the text, we add a single space and modify the change so it is
                            // dealing with a range of characters instead of an insertion point.
                            // This lets us remove the marks around the range.
                            
                            // TODO: this seems to interfere with the undo history
                            
                            editor.replaceRange(' ', changeObj.from, changeObj.to, 'brighspotTrackSpace');
                            changeObj.update(changeObj.from, {line:changeObj.to.line, ch:changeObj.to.ch + 1});
                        }

                        self.inlineRemoveStyle('trackInsert', {from: changeObj.from, to: changeObj.to});
                        self.inlineRemoveStyle('trackDelete', {from: changeObj.from, to: changeObj.to});
                    }
                }
            }
        },


        /**
         * For a given range, mark everything as deleted.
         * Also remove any previously inserted content within the range.
         */
        trackMarkDeleted: function(range) {
            
            var editor, self;

            self = this;
            editor = self.codeMirror;
            
            // If we're deleting just a line just let it be deleted
            // Because we don't have a good way to accept or reject a blank line
            textOriginal = editor.getRange(range.from, range.to);
            if (textOriginal === '\n') {
                return;
            }
            
            // Add formatting to show the deleted area
            self.inlineSetStyle('trackDelete', range);

            // Remove any text within the range that is marked as inserted
            self.inlineRemoveStyle('trackInsert', range, {deleteText:true});
        },

        
        /**
         * Accept all the marked changes within a range.
         */ 
        trackAcceptRange: function(range) {
            
            var editor, self;

            self = this;
            editor = self.codeMirror;

            // First combine any of the adjacent track changes
            self.inlineCleanup();
            
            range = range || self.getRange();

            $.each(editor.findMarks(range.from, range.to), function(i, mark) {
                self.trackAcceptMark(mark);
            });
            
        },


        /**
         * Reject all the marked changes within a range.
         */ 
        trackRejectRange: function(range) {
            
            var editor, self;

            self = this;
            editor = self.codeMirror;
            
            // First combine any of the adjacent track changes
            self.inlineCleanup();
            
            range = range || self.getRange();

            $.each(editor.findMarks(range.from, range.to), function(i, mark) {
                self.trackRejectMark(mark);
            });
        },

        
        /**
         * Accept a single marked change.
         */
        trackAcceptMark: function(mark) {

            var editor, position, self;

            self = this;
            editor = self.codeMirror;
            
            position = mark.find();

            if (position && mark.className === self.styles.trackDelete.className) {
                editor.replaceRange('', position.from, position.to, '+brightspotTrackRejectMark');
            }
            
            mark.clear();
        },


        /**
         * Reject a single marked change.
         */
        trackRejectMark: function(mark) {

            var editor, position, self;

            self = this;
            editor = self.codeMirror;
            
            position = mark.find();

            if (position && mark.className === self.styles.trackInsert.className) {
                editor.replaceRange('', position.from, position.to, '+brightspotTrackRejectMark');
            }
            
            mark.clear();
        },


        /**
         * Determine what to show in the editor:
         * The original text marked up with changes
         * Or the final text after changes have been applied
         *
         * @param Boolean showFinal
         * Set to true to show the original text with markup
         * Set to false to show the final text without markup.
         */
        trackDisplaySet: function(value) {
            
            var self;

            self = this;

            self.trackDisplay = value;
            
            self.trackDisplayUpdate();
            
        },

        
        /**
         * Toggle the trackDisplay setting (see trackDisplaySet).
         * Determines if we are showing the original text marked up with changes, or the final text after changes are applied.
         */
        trackDisplayToggle: function() {
            
            var self;

            self = this;

            self.trackDisplaySet( !self.trackDisplayGet() );
        },

        
        /*
         * Get the current value of the trackDisplay setting.
         * Determines if we are showing the original text marked up with changes, or the final text after changes are applied.
         */
        trackDisplayGet: function() {
            
            var self;

            self = this;
            
            return self.trackDisplay;
        },

        
        /**
         * Update the display to hide or show the markings based on the current value of trackDisplay.
         * Determines if we are showing the original text marked up with changes, or the final text after changes are applied.
         */
        trackDisplayUpdate: function() {
            
            var editor, pos, self, $wrapper;

            self = this;
            editor = self.codeMirror;

            $wrapper = $(editor.getWrapperElement());

            // Set a class that can be used to style the inserted elements.
            // When this class is active the inserted elements can be style with a background color
            // but when the class is not active the inserted elements should not be styled
            // so they  will appear as in the final result
            $wrapper.toggleClass(self.styles.trackDisplay.className, self.trackDisplay);

            // Find all the marks for deleted elements
            $.each(editor.getAllMarks(), function(i, mark) {

                // Remove of the trackDeleteHidden marks that were previously set
                if (mark.className === self.styles.trackDeleteHidden.className) {
                    mark.clear();
                }

                if (mark.className === self.styles.trackDelete.className && !self.trackDisplay) {

                    // Hide the deleted elements by creating a new mark that collapses (hides) the text
                    
                    pos = mark.find();
                    
                    editor.markText(pos.from, pos.to, {
                        className: self.styles.trackDeleteHidden.className,
                        collapsed: true
                    });
                }
            });
        },


        //==================================================
        // Miscelaneous Functions
        //==================================================


        /**
         * Give focus to the editor
         */
        focus: function() {
            var self;
            self = this;
            self.codeMirror.focus();
        },


        /**
         * Returns the character count of the editor.
         * Note this counts only the plain text, not including the HTML elements that will be in the final result.
         * @returns Number
         */
        getCount: function() {
            var count, self;
            self = this;
            return self.toText().length;
        },

        
        /**
         * Gets the currently selected range.
         *
         * @returns Object
         * An object with {from,to} values for the currently selected range.
         * If a range is not selected, returns {from:0,to:0}
         */
        getRange: function(){

            var self;

            self = this;

            return {
                from: self.codeMirror.getCursor('from'),
                to: self.codeMirror.getCursor('to')
            };
        },


        /**
         * Returns a range that represents the entire document.
         *
         * @returns Object
         * An object with {from,to} values for the entire docuemnt.
         */
        getRangeAll: function(){

            var self, totalLines;

            self = this;

            totalLines = self.codeMirror.lineCount();

            return {
                from: {line: 0, ch: 0},
                to: {line: totalLines - 1, ch: self.codeMirror.getLine(totalLines - 1).length}
            };
        },

        
        /**
         * Rework the styles object so it is indexed by the className,
         * to make looking up class names easier.
         *
         * @returns Object
         * The styles object, but rearranged so it is indexed by the classname.
         * For each parameter in the object, a "key" parameter is added so you can
         * still determine the original key into the styles object.
         *
         * For example, if the styles object originally contains the following:
         * { 'bold': { className: 'rte2-style-bold' } }
         *
         * Then this function returns the following:
         * { 'rte2-style-bold': { key: 'bold', className: 'rte2-style-bold' } }
         */
        getClassNameMap: function() {
            
            var self, map;

            self = this;

            map = {};

            $.each(self.styles, function(key, styleObj) {
                var className;
                className = styleObj.className;
                styleObj.key = key;
                map[ className ] = styleObj;
            });

            return map;
        },
        

        /**
         * Rework the styles object so it is indexed by the element,
         * to make importing elements easier.
         *
         * @returns Object
         * The styles object, but rearranged so it is indexed by the element name.
         * For each parameter in the object, a "key" parameter is added so you can
         * still determine the original key into the styles object.
         *
         * Since a single element might map to more than one style depending on the
         * attributes of the element, we use an array to hold the styles that might
         * map to that element.
         *
         * For example, if the styles object originally contains the following:
         * { 'bold': { className: 'rte2-style-bold', element:'b' } }
         *
         * Then this function returns the following:
         * { 'b': [{ key: 'bold', className: 'rte2-style-bold', element:'b'}] }
         */
        getElementMap: function() {
            
            var self, map;

            self = this;

            map = {};

            $.each(self.styles, function(key, styleObj) {
                var element;
                element = styleObj.element;
                styleObj.key = key;

                // Create array of styles to which this element might map
                map[element] = map[element] || [];
                map[element].push(styleObj);
            });

            return map;
        },
        

        /**
         * Tell the editor to update the display.
         * You should call this if you modify the size of any enhancement content
         * that is in the editor.
         */
        refresh: function(mark) {
            var self;
            self = this;
            self.codeMirror.refresh();
        },


        /**
         * Empty the editor and clear all marks and enhancements.
         */
        empty: function() {
            var editor, self;
            self = this;
            self.codeMirror.setValue('');

            // Destroy all enhancements
            $.each(self.enhancementCache, function(i, mark) {
                self.enhancementRemove(mark);
            });
        },


        /**
         * Determine if an element is a "container" for another element.
         * For example, element "li" is contained within a "ul" or "ol" element.
         *
         * @param {String} elementName
         * The name of an element such as "ul"
         *
         * @return {Boolean}
         */
        elementIsContainer: function(elementName) {
            var isContainer, self;
            self = this;
            isContainer = false;
            $.each(self.styles, function(styleKey, styleObj){
                if (elementName === styleObj.elementContainer) {
                    isContainer = true;
                    return false; // Stop looping because we found one
                }
            });
            return isContainer;
        },


        /**
         * Returns a keymap based on the styles definition.
         *
         * @return {Object}
         * Keymap for CodeMirror.
         */
        getKeys: function() {
            
            var keymap, self;

            self = this;

            keymap = {};
            
            $.each(self.styles, function(styleKey, styleObj) {

                var keys;

                keys = styleObj.keymap;
                
                if (keys) {
                    
                    if (!$.isArray(styleObj.keymap)) {
                        keys = [keys];
                    }
                    
                    $.each(keys, function(i, keyName) {
                        keymap[keyName] = function (cm) {
                            return self.toggleStyle(styleKey);
                        };
                    });
                }
            });

            return keymap;
        },


        /**
         * Get plain text from codemirror.
         * @returns String
         */
        toText: function() {
            var count, self;
            self = this;
            return self.codeMirror.getValue();
        },

        
        /**
         * Get content from codemirror, analyze the marked up regions,
         * and convert to HTML.
         */
        toHTML: function() {

            /**
             * Create the opening HTML element for a given style object.
             *
             * @param {Object|Function} styleObj
             * A style object as defined in this.styles, or a function that will return the opening HTML element.
             * @param {String} styleObj.element
             * The element to create. For example: "EM"
             * @param {Object} [styleObj.elementAttr]
             * An object containing additional attributes to add to the element.
             * For example: {'style': 'font-weight:bold'}
             */
            function openElement(styleObj) {
                
                var html = '';

                if (styleObj.markToHTML) {
                    html = styleObj.markToHTML();
                } else if (styleObj.element) {
                    html = '<' + styleObj.element;

                    if (styleObj.elementAttr) {
                        $.each(styleObj.elementAttr, function(attr, value) {
                            html += ' ' + attr + '="' + value + '"';
                        });
                    }

                    // For void elements add a closing slash when closing, like <br/>
                    if (self.voidElements[ styleObj.element ]) {
                        html += '/';
                    }
                    
                    html += '>';
                }
                
                return html;
            }

            var blockElementsToClose, blockActive, doc, enhancementsByLine, html, self;

            self = this;

            // Before beginning make sure all the marks are cleaned up and simplified.
            // This will ensure that none of the marks span across lines.
            self.inlineCleanup();

            // Clean up any "raw html" areas so they do not allow styles inside
            self.rawCleanup();
            
            doc = self.codeMirror.getDoc();

            // List of block styles that are currently open.
            // We need this so we can continue a list on the next line.
            blockActive = {};
            
            // List of block elements that are currently open
            // We need this so we can close them all at the end of the line.
            blockElementsToClose = [];

            // Go through all enhancements and figure out which line number they are on
            enhancementsByLine = {};
            $.each(self.enhancementCache, function(i, mark) {

                var lineNo;

                lineNo = self.enhancementGetLineNumber(mark);

                // Create an array to hold the enhancements for this line, then add the current enhancement
                enhancementsByLine[lineNo] = enhancementsByLine[lineNo] || [];
                
                enhancementsByLine[lineNo].push(mark);
            });

            // Start the HTML!
            html = '';
            
            // Loop through the content one line at a time
            doc.eachLine(function(line) {

                var annotationStart, annotationEnd, blockOnThisLine, htmlStartOfLine, htmlEndOfLine, inlineActive, inlineElementsToClose, lineNo, outputChar, raw, rawLastChar;

                lineNo = line.lineNo();
                
                htmlStartOfLine = '';
                htmlEndOfLine = '';
                
                // List of inline styles that are currently open.
                // We need this because if we close one element we will need to re-open all the elements.
                inlineActive = {};

                // List of inline elements that are currently open
                // (in the order they were opened so they can be closed in reverse order)
                inlineElementsToClose = [];

                // Keep track of the block styles we find only on this line,
                // so we know when to end a list.
                // For example, if the previous line was in a list,
                // and the current line contains a list item, then we keep the list open.
                // But if the current line does not contain a list item then we close the list.
                blockOnThisLine = {};
                
                // Get any line classes and determine which kind of line we are on (bullet, etc)
                // Note this does not support nesting line elements (like a list within a list)
                // From CodeMirror, the textClass property will contain multiple line styles separated by space
                // like 'rte2-style-ol rte2-style-align-left'
                if (line.textClass) {
                    
                    $.each(line.textClass.split(' '), function() {
                        
                        var container, styleObj;

                        // From a line style (like "rte2-style-ul"), determine the style name it maps to (like "ul")
                        styleObj = self.classes[this];
                        if (!styleObj) {
                            return;
                        }

                        // Get the "container" element for this style (for example: ul or ol)
                        container = styleObj.elementContainer;
                        if (container) {

                            // Mark that we found this container, so later we can close off any containers that are not active any more.
                            // For example this will set blockOnThisLine.ul to true.
                            blockOnThisLine[container] = true;
                            
                            // Check to see if we are already inside this container element
                            if (blockActive[container]) {

                                // We are currently inside this style so we don't need to open the container element
                                
                            } else {

                                // We are not already inside this style, so create the container element
                                // and remember that we created it
                                blockActive[container] = true;
                                htmlStartOfLine += '<' + container + '>';
                            }
                        }

                        // Now determine which element to create for the line.
                        // For example, if it is a list then we would create an 'LI' element.
                        htmlStartOfLine += openElement(styleObj);

                        // Also push this style onto a stack so when we reach the end of the line we can close the element
                        blockElementsToClose.push(styleObj);
                        
                    }); // .each
                }// if line.textClass

                
                // Now that we know which line styles are on this line, we can tell if we need to continue a list
                // from a previous line, or actually close the list.
                // Loop through all the blocks that are currently active (from this line and previous lines)
                // and find the ones that are not active on this line.
                $.each(blockActive, function(container) {

                    if (!blockOnThisLine[container]) {
                        delete blockActive[container];
                        if (container) {
                            html += '</' + container + '>';
                        }
                    }
                });

                // Determine if there are any enhancements on this line
                if (enhancementsByLine[lineNo]) {
                    
                    $.each(enhancementsByLine[lineNo], function(i,mark) {

                        var enhancmentHTML;

                        enhancementHTML = '';
                        if (mark.options.toHTML) {
                            enhancementHTML = mark.options.toHTML();
                        }

                        if (enhancementHTML) {

                            if (mark.above) {
                                html += enhancementHTML;
                            } else {
                                htmlEndOfLine += enhancementHTML;
                            }
                        }
                    });
                }

                // Now add the html for the beginning of the line.
                html += htmlStartOfLine;
                
                // Get the start/end points of all the marks on this line
                // For these objects the key is the character number,
                // and the value is an array of class names. For example:
                // {'5': 'rte2-style-subscript'}
                
                annotationStart = {};
                annotationEnd = {};
                
                if (line.markedSpans) {
                    
                    $.each(line.markedSpans, function(key, markedSpan) {
                        
                        var className, endArray, endCh, mark, startArray, startCh, styleObj;

                        startCh = markedSpan.from;
                        endCh = markedSpan.to;
                        className = markedSpan.marker.className;

                        // Skip markers that do not have a className.
                        // For example an inline enhancement might cause this.
                        if (!className) {
                            return;
                        }
                        
                        // Skip markers that do not cover any characters
                        // For example if you go to the start of a line and click Bold,
                        // then do not enter test.
                        if (startCh === endCh) {
                            return;
                        }

                        styleObj = self.classes[className] || {};

                        // Skip any marker where we don't have an element mapping
                        if (!(styleObj.element || styleObj.raw)) {
                            return;
                        }

                        // Get the mark object because it might contain additional data we need.
                        // We will pass the mark to the 'toHTML" function for the style if that exists
                        mark = markedSpan.marker || {};
                        
                        // Create an array of styles that start on this character
                        if (!annotationStart[startCh]) {
                            annotationStart[startCh] = [];
                        }

                        // Create an array of styles that end on this character
                        if (!annotationEnd[endCh]) {
                            annotationEnd[endCh] = [];
                        }

                        // If the style has a toHTML filter function, we must call it
                        if (styleObj.toHTML) {

                            // Create a new function that converts this style to HTML
                            // based on the additional content stored with the mark.
                            annotationStart[startCh].push( $.extend(
                                true, {}, styleObj, {
                                    markToHTML: function() {
                                        return styleObj.toHTML(mark);
                                    }
                                }
                            ));
                            
                        } else {

                            // There is no custom toHTML function for this
                            // style, so we'll just use the style object
                            annotationStart[startCh].push(styleObj);
                        }
                        
                        // Add the element to the start and end annotations for this character
                        annotationEnd[endCh].push(styleObj);

                    });
                }

                // Loop through each character in the line string.
                for (charNum = 0; charNum <= line.text.length; charNum++) {
                    
                    // Do we need to end elements at this character?
                    if (annotationEnd[charNum]) {

                        // Close all the active elements in the reverse order they were created
                        $.each(inlineElementsToClose.reverse(), function(i, element) {
                            if (element && !self.voidElements[element]) {
                                html += '</' + element + '>';
                            }
                        });
                        inlineElementsToClose = [];

                        // Find out which elements are no longer active
                        $.each(annotationEnd[charNum], function(i, styleObj) {
                            
                            // If any of the styles is "raw" mode, clear the raw flag
                            if (styleObj.raw) {
                                raw = false;
                            }
                            
                            delete inlineActive[styleObj.className];
                        });

                        // Re-open elements that are still active
                        $.each(inlineActive, function(className, styleObj) {
                            var element;
                            if (!self.voidElements[ styleObj.element ]) {
                                inlineElementsToClose.push(styleObj.element);
                                html += openElement(styleObj);
                            }
                        });

                    }

                    if (annotationStart[charNum]) {
                        
                        $.each(annotationStart[charNum], function(i, styleObj) {

                            // If any of the styles is "raw" mode, set a raw flag for later
                            if (styleObj.raw) {
                                raw = true;
                            }
                            
                            if (!inlineActive[styleObj.className]) {

                                // Save this element on the list of active elements
                                inlineActive[styleObj.className] = styleObj;

                                // Also push it on a stack so we can close elements in reverse order
                                if (!self.voidElements[ styleObj.element ]) {
                                    inlineElementsToClose.push(styleObj.element);
                                }

                                // Open the new element
                                html += openElement(styleObj);
                            }
                        });
                    }

                    outputChar = line.text.charAt(charNum);

                    // In some cases (at end of line) output char might be empty
                    if (outputChar) {
                        
                        if (raw) {

                            if (outputChar === '<') {
                                outputChar = '&raw_lt;';
                            }

                            rawLastChar = true;
                        
                        } else {
                        
                            outputChar = self.htmlEncode(outputChar);
                        
                            rawLastChar = false;
                        }
                        
                        html += outputChar;
                    }
                }

                // If we reached end of line, close all the open block elements
                if (blockElementsToClose.length) {
                    
                    $.each(blockElementsToClose.reverse(), function() {
                        var element;
                        element = this.element;
                        if (element) {
                            html += '</' + element + '>';
                        }
                    });
                    blockElementsToClose = [];
                    
                } else if (rawLastChar) {
                    html += '\n';
                } else {
                    // No block elements so add a line break
                    html += '<br/>';
                }

                // Add any content that needs to go after the line
                // for example, enhancements that are positioned below the line.
                if (htmlEndOfLine) {
                    html += htmlEndOfLine;
                }
            });

            // When we finish with the final line close any block elements that are still open
            $.each(blockActive, function(container) {
                delete blockActive[container];
                if (container) {
                    html += '</' + container + '>';
                }
            });

            html = html.replace(/&raw_lt;(\w+)/g, '<$1 data-rte2-raw').replace(/&raw_lt;/g, '<');
            
            return html;
            
        }, // toHTML

        
        /**
         * Import HTML content into the editor.
         *
         * @param {String} html
         */
        fromHTML: function(html) {

            var annotations, editor, enhancements, el, map, self, val;

            self = this;

            self.empty();
            
            editor = self.codeMirror;

            // Convert the styles object to an object that is indexed by element,
            // so we can quickly map an element to a style.
            // Note there might be more than one style for an element, in which
            // case we will use attributes to determine if we have a match.
            map = self.getElementMap();

            // Convert HTML into a DOM element so we can parse it using the browser node functions
            el = $("<div/>").append(html)[0];

            // Text for the editor
            val = '';

            // Inline and block markers
            annotations = [];
            enhancements = [];
            
            function processNode(n, rawParent) {
                
                var elementName, elementClose, from, isContainer, matchStyleObj, next, raw, rawChildren, split, to;

                next = n.childNodes[0];

                while (next) {

                    // Check if we got a text node or an element
                    if (next.nodeType === 3) {

                        // We got a text node, just add it to the value
                        // Remove any newlines at the beginning or end
                        // Remove "zero width space" character that the previous editor sometimes used
                        //val += next.textContent.replace(/^[\n\r]+|[\n\r]+$/g, '').replace(/\u200b|\u8203/g, '');
                        val += next.textContent.replace(/\u200b|\u8203/g, '');
                        
                    } else if (next.nodeType === 1) {

                        // We got an element
                        elementName = next.tagName.toLowerCase();

                        raw = false;
                        if (rawParent) {
                            raw = true;
                            rawChildren = true;
                        } else {
                            raw = $(next).is('[data-rte2-raw]');
                        }
                        
                        // Determine how to map the element to a marker
                        matchStyleObj = '';
                        matchArray = map[elementName];
                        if (matchArray && !raw) {

                            $.each(matchArray, function(i, styleObj) {

                                // Detect blocks that have containers (like "li") and make sure we are within that container
                                if (styleObj.elementContainer && styleObj.elementContainer.toLowerCase() !== next.parentElement.tagName.toLowerCase()) {
                                    return;
                                }

                                // If the style has attributes listed we must check to see if they match this element
                                if (styleObj.elementAttr) {

                                    // Loop through all the attributes in the style definition,
                                    // and see if we get a match
                                    $.each(styleObj.elementAttr, function(attr, expectedValue) {

                                        var attributeValue;

                                        attributeValue = $(next).attr(attr);
                                        if (attributeValue === expectedValue) {
                                            // We got a match!
                                            // But if there is more than one attribute listed,
                                            // we keep looping and all of them must match!
                                            matchStyleObj = styleObj;
                                        } else {
                                            
                                            // The attribute did not match so we do not have a match.
                                            matchStyleObj = false;
                                            
                                            // Stop looping through the rest of the attributes.
                                            return false;
                                        }
                                    });

                                } else {
                                    
                                    // There were no attributes specified for this style.
                                    matchStyleObj = styleObj;
                                }

                                // Stop after first style that matches
                                if (matchStyleObj) {
                                    return false;
                                }
                            });
                        }

                        // Figure out which line and character for the start of our element
                        split = val.split("\n");
                        from =  {
                            line: split.length - 1,
                            ch: split[split.length - 1].length
                        };

                        // Special case - is this an enhancement?
                        if (elementName === 'span' && $(next).attr('class') === 'enhancement') {

                            enhancements.push({
                                line: from.line,
                                $content: $(next)
                            });

                            // Skip past the enhancement
                            next = next.nextSibling;
                            continue;
                        }

                        // For container elements such as "ul" or "ol", do not allow nested lists within.
                        // If we find a nested list treat the whole thing as raw html
                        isContainer = self.elementIsContainer(elementName);
                        if (isContainer) {
                            
                            // If there are any nested list items, then we treat this element as raw html
                            if ($(next).find('li li').length) {
                                raw = true;
                                rawChildren = true;
                            }
                            
                        }
                        
                        // Do we need to keep this element as raw HTML?
                        // Check if we have not yet matched this element
                        // Check if this is not a BR element.
                        // Check if this element is a "container" element such as a "ul" that contains an "li" element.
                        if (!matchStyleObj && !isContainer && elementName !== 'br') {
                            raw = true;
                        }

                        if (elementName === 'br') {
                            raw = false;
                        }
                        
                        if (raw) {
                            
                            matchStyleObj = self.styles.html;
                            
                            val += '<' + elementName;

                            $.each(next.attributes, function(i, attrib){
                                
                                var attributeName = attrib.name;
                                var attributeValue = attrib.value;

                                // Skip the data-rte2-raw attribute since that is used only to
                                // indicate which elements were previously marked as raw html
                                if (attributeName === 'data-rte2-raw') {
                                    return;
                                }
                                
                                val += ' ' + attributeName + '="' + self.htmlEncode(attributeValue) + '"';
                            });

                            // Close void elements like <input/>
                            if (self.voidElements[ elementName ]) {
                                val += '/';
                            }
                            
                            val += '>';

                            // End the mark for raw HTML
                            split = val.split("\n");
                            to =  {
                                line: split.length - 1,
                                ch: split[split.length - 1].length
                            };
                            annotations.push({
                                styleObj:matchStyleObj,
                                from:from,
                                to:to
                            });
                            
                            // Remember we need to close the element later
                            if (!self.voidElements[ elementName ]) {
                                elementClose = '</' + elementName + '>';
                            }
                        }

                        // Recursively go into our element and add more text to the value
                        processNode(next, rawChildren);

                        if (elementClose) {

                            // Create a new starting point for raw html annotation
                            split = val.split("\n");
                            from =  {
                                line: split.length - 1,
                                ch: split[split.length - 1].length
                            };

                            // Add the closing element
                            val += elementClose;
                            elementClose = '';
                        }
                        
                        // Now figure out the line and character for the end of our element
                        split = val.split("\n");
                        to =  {
                            line: split.length - 1,
                            ch: split[split.length - 1].length
                        };

                        if (matchStyleObj) {

                            // Check to see if there is a fromHTML function for this style
                            if (matchStyleObj.fromHTML) {

                                // Yes, there is a fromHTML function, so as part of this annotation we will create
                                // a function that reads information from the element and saves it on the mark.

                                // Since we're in a loop we can't rely on closure variables to maintain the
                                // current values, so we're using a special javascript trick to get around that.
                                // The with statement will create a new closure for each loop.
                                with ({matchStyleObj:matchStyleObj, next:next, from:from, to:to}) {
                                    
                                    annotations.push({
                                        styleObj: $.extend({}, matchStyleObj, {
                                            filterFromHTML: function(mark){
                                                matchStyleObj.fromHTML( $(next), mark );
                                            }
                                        }),
                                        from:from,
                                        to:to
                                    });
                                }
                                
                            } else {
                                annotations.push({
                                    styleObj:matchStyleObj,
                                    from:from,
                                    to:to
                                });
                            }
                        }

                        // Add a new line for certain elements
                        // Add a new line for custom elements
                        if (self.newLineRegExp.test(elementName)
                            || (matchStyleObj && matchStyleObj.line)) {
                            
                            val += '\n';
                        }

                    } // else if this is an element...
                    
                    next = next.nextSibling;
                    
                } // while there is a next sibling...
                
            } // function processNode

            processNode(el);

            // Set the text in the editor
            val = val.replace(/[\n\r]+$/, '');
            editor.setValue(val);

            // Set up all the annotations
            $.each(annotations, function(i, annotation) {

                var range, styleObj;

                styleObj = annotation.styleObj;

                if (styleObj.line) {
                    self.blockSetStyle(styleObj, annotation);
                } else {
                    self.inlineSetStyle(styleObj, annotation);
                }
            });

            $.each(enhancements, function(i, enhancementObj) {
                
                // Pass off control to a user-defined function for adding enhancements
                self.enhancementFromHTML(enhancementObj.$content, enhancementObj.line);
                
            });

            // Clear the undo history
            editor.clearHistory();
            
        }, // fromHTML()


        /**
         * Encode text so it is HTML safe.
         * @param {String} s
         * @return {String}
         */
        htmlEncode: function(s) {
            return String(s)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
    };

    return CodeMirrorRte;

}); // define

// Set filename for debugging tools to allow breakpoints even when using a cachebuster
//# sourceURL=richtextCodeMirror.js
