/* See license.txt for terms of usage */

define([
    "firebug/firebug",
    "firebug/lib/http",
    "firebug/lib/dom",
],
function (Firebug, Http, Dom) {

// ********************************************************************************************* //
// Constants

// CodeMirror files. These scripts are dynamically included into panel.html.
var codeMirrorSrc = "chrome://firebug/content/editor/codemirror/codemirror.js";
var jsModeSrc = "chrome://firebug/content/editor/codemirror/mode/javascript.js";
var htmlMixedModeSrc = "chrome://firebug/content/editor/codemirror/mode/htmlmixed.js";
var xmlModeSrc = "chrome://firebug/content/editor/codemirror/mode/xml.js";

// Tracing helpers
var Trace = FBTrace.to("DBG_SCRIPTEDITOR");
var TraceError = FBTrace.to("DBG_ERRORS");

var WRAP_CLASS = "CodeMirror-debugLocation";
var BACK_CLASS = "CodeMirror-debugLocation-background";

// ********************************************************************************************* //
// Source Editor Implementation

function SourceEditor()
{
    this.view = null;
    this.config = {};
    this.editorObject = null;
    this.debugLocation = -1;
}

SourceEditor.DefaultConfig =
{
    value: "",
    mode: "htmlmixed",
    theme: "firebug",
    indentUnit: 2,
    tabSize: 4,
    smartIndent: true,
    extraKeys: {},
    lineWrapping: false,
    lineNumbers: true,
    firstLineNumber: 1,
    gutters: ["breakpoint"],
    fixedGutter: false,
    readOnly: true,
    showCursorWhenSelecting: true,
    undoDepth: 200,

    // xxxHonza: this is weird, wnen this props is set the editor is displayed twice
    // (there is one-line editor created at the bottom of the Script panel just switch
    // to the CSS panel and back).
    //autofocus: true
};

SourceEditor.Events =
{
    change: "change",
    beforeChange: "beforeChange",
    cursorActivity: "cursorActivity",
    beforeSelectionChange: "beforeSelectionChange",
    viewportChange: "viewportChange",
    gutterClick: "gutterClick",
    focus: "focus",
    blur: "blur",
    scroll: "scroll",
    update: "update",
    renderLine: "renderLine",
    breakpointChange: "breakpointchange",
    contextMenu: "contextmenu",
    mouseMove: "mousemove",
    mouseOut: "mouseout",
    mouseOver: "mouseover"
};

SourceEditor.prototype =
{
    init: function (parentNode, config, callback)
    {
        var doc = parentNode.ownerDocument;

        // Append CM scripts into the panel.html
        Dom.addScript(doc, "cm", Http.getResource(codeMirrorSrc));
        Dom.addScript(doc, "cm-js", Http.getResource(jsModeSrc));
        Dom.addScript(doc, "cm-xml", Http.getResource(xmlModeSrc));
        Dom.addScript(doc, "cm-htmlmixed", Http.getResource(htmlMixedModeSrc));

        for (var prop in SourceEditor.DefaultConfig)
        {
            this.config[prop] = prop in config ? config[prop] :
                SourceEditor.DefaultConfig[prop];
        }

        function onEditorCreate(elt)
        {
            Trace.sysout("sourceEditor.onEditorCreate;", this.view);

            parentNode.appendChild(elt);

            this.view = elt;

            callback();
        }

        // Create editor;
        this.editorObject = doc.defaultView.CodeMirror(
            onEditorCreate.bind(this), config);

        Trace.sysout("sourceEditor.init; ", this.view);
    },

    addEventListener: function (type, handler)
    {
        if (type in SourceEditor.Editor)
        {
            if (isSupportedEvent(type))
            {
                this.editorObject.on(SourceEditor.Events[type], function ()
                {
                    handler(getEventObject(type, arguments));
                });
            }
            else if (type == SourceEditor.Events.breakpointChange)
            {
                this.bpChangingHandler = handler;
            }
            else
            {
                editorNode = this.editorObject.getWrapperElement();
                editorNode.addEventListener(SourceEditor.Events[type], handler, false);
            }
        }
    },

    removeEventListener: function (type, handler)
    {
        if (type in SourceEditor.Editor)
        {
            if (isSupportedEvent(type))
            {
                this.editorObject.off(SourceEditor.Events[type], handler);
            }
            else
            {
                editorNode = this.editorObject.getWrapperElement();
                editorNode.removeEventListener(SourceEditor.Events[type], handler, false);
            }
        }
    },

    addBreakpoint: function (lineNo, condition)
    {
        this.editorObject.on(SourceEditor.Events.gutterClick,
            function (cmInstance, line, gutter, event)
            {
                if (gutter == "breakpoints")
                {
                    // TODO: add breakpoint

                    /*var info = this.editorObject.lineInfo(lineNo);
                    if (info.gutterMarkers)
                    this.editorObject.setGutterMarker(lineNo, "breakpoints", breakpointIcon);*/

                    if (this.bpChangingHandler)
                    {
                        var event = {
                            added: [{ line: lineNo, condition: condition}],
                            removed: []
                        };
                        this.bpChangingHandler(event);
                    }
                }
            });
    },

    removeBreakpoint: function (lineNo, condition)
    {
        this.editorObject.on(SourceEditor.Events.gutterClick,
            function (cmInstance, line, gutter, event)
            {
                if (gutter == "breakpoints")
                {
                    var info = this.editorObject.lineInfo(lineNo);
                    if (info.gutterMarkers)
                        this.editorObject.setGutterMarker(lineNo, "breakpoints", null);

                    if (this.bpChangingHandler)
                    {
                        var event = {
                            added: [],
                            removed: [{ line: lineNo, condition: condition}]
                        };
                        this.bpChangingHandler(event);
                    }
                }
            });
    },

    destroy: function ()
    {
        // TODO
    },

    setText: function (text)
    {
        Trace.sysout("sourceEditor.setText", text);

        text = text || "";
        this.editorObject.setValue(text);
    },

    getText: function ()
    {
        return this.editorObject.getValue();
    },

    getCharCount: function ()
    {
        this.editorObject.getValue().length;
    },

    setDebugLocation: function(line)
    {
        Trace.sysout("sourceEditor.setDebugLocation; line: " + line);

        if (this.debugLocation == line)
            return;

        if (this.debugLocation != -1)
        {
            var handle = this.editorObject.getLineHandle(this.debugLocation);
            this.editorObject.removeLineClass(handle, "wrap", WRAP_CLASS);
            this.editorObject.removeLineClass(handle, "background", BACK_CLASS);
        }

        this.debugLocation = line;

        if (this.debugLocation != -1)
        {
            var handle = this.editorObject.getLineHandle(line);
            this.editorObject.addLineClass(handle, "wrap", WRAP_CLASS);
            this.editorObject.addLineClass(handle, "background", BACK_CLASS);
        } 
    },

    scrollToLine: function(line, options)
    {
        options = options || {};

        if (options.scrollTo == "top")
        {
            // Scroll so, the specified line is displayed at the top of the editor.
            this.editorObject.scrollIntoView({line: line});
        }
        else
        {
            var scrollInfo = this.editorObject.getScrollInfo();
            var hScrollBar = this.view.getElementsByClassName("CodeMirror-hscrollbar")[0];

            // Do not include h-scrollbar in editor height (even if CM docs says getScrollInfo
            // returns the visible area minus scrollbars, it doesn't seem to work).
            var editorHeight = scrollInfo.clientHeight - hScrollBar.offsetHeight;
            var coords = this.editorObject.charCoords({line: line, ch: 0}, "local");
            var top = coords.top;
            var bottom = coords.bottom;

            var lineHeight = this.editorObject.defaultTextHeight();

            // Scroll only if the target line is outside of the viewport.
            if (top <= scrollInfo.top || bottom >= scrollInfo.top + editorHeight)
            {
                var middle = top - (editorHeight / 2);
                this.editorObject.scrollTo(null, middle);
            }
        }
    },

    getTopIndex: function()
    {
        // TODO
        return 0;
    },

    setTopIndex: function()
    {
        // TODO
    }
};

// ********************************************************************************************* //
// Local Helpers

function editorSupportedEvenets()
{
    return {
        change: "change",
        beforeChange: "beforeChange",
        cursorActivity: "cursorActivity",
        beforeSelectionChange: "beforeSelectionChange",
        viewportChange: "viewportChange",
        gutterClick: "gutterClick",
        focus: "focus",
        blur: "blur",
        scroll: "scroll",
        update: "update",
        renderLine: "renderLine"
    };
}

function isSupportedEvent(eventType)
{
    var supportedEvents = editorSupportedEvenets();
    return (eventType in supportedEvents ? true : false);
}

function getEventObject(type, eventArg)
{
    var eventName = SourceEditor.Events[type];
    var event = {};

    switch (type)
    {
        case "change":
        case "beforeChange":
            event.changedObj = eventArg[1];
            break;
        case "beforeSelectionChange":
            event.selection = eventArg[1];
            break;
        case "viewportChange":
            event.from = eventArg[1];
            event.to = eventArg[2];
            break;
        case "gutterClick":
            event.line = eventArg[1];
            event.gutter = eventArg[2];
            event.rawEvent = eventArg[3];
            break;
    }

    return event;
}

// ********************************************************************************************* //
// Registration

return SourceEditor;

// ********************************************************************************************* //
});