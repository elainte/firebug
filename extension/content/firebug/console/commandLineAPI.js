/* See license.txt for terms of usage */
/*jshint esnext:true, es5:true, curly:false, evil:true*/
/*global Firebug:true, FBTrace:true, define:true */

define([
    "firebug/lib/xpath",
    "firebug/lib/array",
    "firebug/lib/locale",
    "firebug/lib/system",
    "firebug/lib/wrapper",
],
function(Xpath, Arr, Locale, System, Wrapper) {
"use strict";

// ********************************************************************************************* //
// Command Line API

var CommandLineAPI = {};

/**
 * Gets the command line API for a context.
 *
 * @param {*} context The context
 *
 * @return {*} The command line object
 */
CommandLineAPI.getCommandLineAPI = function(context)
{
    var commands = Object.create(null);

    // returns unwrapped elements from the page
    commands.$ = function(selector, start)
    {
        if (start && start.querySelector && (
            start.nodeType === Node.ELEMENT_NODE ||
            start.nodeType === Node.DOCUMENT_NODE ||
            start.nodeType === Node.DOCUMENT_FRAGMENT_NODE))
        {
            return start.querySelector(selector);
        }

        var result = context.baseWindow.document.querySelector(selector);
        if (result === null && (selector || "")[0] !== "#")
        {
            if (context.baseWindow.document.getElementById(selector))
            {
                // This should be removed in the next minor (non-bugfix) version
                var msg = Locale.$STRF("warning.dollar_change", [selector]);
                Firebug.Console.log(msg, context, "warn");
                result = null;
            }
        }

        return result;
    };

    // returns unwrapped elements from the page
    commands.$$ = function(selector, start)
    {
        var result;

        if (start && start.querySelectorAll && (
            start.nodeType === Node.ELEMENT_NODE ||
            start.nodeType === Node.DOCUMENT_NODE ||
            start.nodeType === Node.DOCUMENT_FRAGMENT_NODE))
        {
            result = start.querySelectorAll(selector);
        }
        else
        {
            result = context.baseWindow.document.querySelectorAll(selector);
        }

        return Arr.cloneArray(result);
    };

    // returns unwrapped elements from the page
    commands.$x = function(xpath, contextNode, resultType)
    {
        var XPathResultType = XPathResult.ANY_TYPE;

        switch (resultType)
        {
            case "number":
                XPathResultType = XPathResult.NUMBER_TYPE;
                break;

            case "string":
                XPathResultType = XPathResult.STRING_TYPE;
                break;

            case "bool":
                XPathResultType = XPathResult.BOOLEAN_TYPE;
                break;

            case "node":
                XPathResultType = XPathResult.FIRST_ORDERED_NODE_TYPE;
                break;

            case "nodes":
                XPathResultType = XPathResult.UNORDERED_NODE_ITERATOR_TYPE;
                break;
        }

        var doc = Wrapper.unwrapObject(context.baseWindow.document);
        return Xpath.evaluateXPath(doc, xpath, contextNode, XPathResultType);
    };

    // values from the extension space
    commands.$n = function(index)
    {
        var htmlPanel = context.getPanel("html", true);
        if (!htmlPanel)
            return null;

        if (index < 0 || index >= htmlPanel.inspectorHistory.length)
            return null;

        var node = htmlPanel.inspectorHistory[index];
        if (!node)
            return node;

        return Wrapper.unwrapObject(node);
    };

    commands.cd = function(object)
    {
        if (!(object instanceof window.Window))
            throw new Error("Object must be a window.");

        // Make sure the command line is attached into the target iframe.
        var consoleReady = Firebug.Console.isReadyElsePreparing(context, object);
        if (FBTrace.DBG_COMMANDLINE)
            FBTrace.sysout("commandLine.cd; console ready: " + consoleReady);

        // The window object parameter uses XPCSafeJSObjectWrapper, but we need XPCNativeWrapper
        // So, look within all registered consoleHandlers for
        // the same window (from tabWatcher) that uses uses XPCNativeWrapper (operator "==" works).
        var entry = Firebug.Console.injector.getConsoleHandler(context, object);
        if (entry)
            context.baseWindow = entry.win;

        var format = Locale.$STR("commandline.CurrentWindow") + " %o";
        Firebug.Console.logFormatted([format, context.baseWindow], context, "info");
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    // no web page interaction
    commands.clear = function()
    {
        Firebug.Console.clear(context);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    // no web page interaction
    commands.inspect = function(obj, panelName)
    {
        Firebug.chrome.select(obj, panelName);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.keys = function(o)
    {
        // the object is from the page, unwrapped
        return Arr.keys(o);
    };

    commands.values = function(o)
    {
        // the object is from the page, unwrapped
        return Arr.values(o);
    };

    commands.debug = function(fn)
    {
        Firebug.Debugger.monitorFunction(fn, "debug");
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.undebug = function(fn)
    {
        Firebug.Debugger.unmonitorFunction(fn, "debug");
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.monitor = function(fn)
    {
        Firebug.Debugger.monitorFunction(fn, "monitor");
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.unmonitor = function(fn)
    {
        Firebug.Debugger.unmonitorFunction(fn, "monitor");
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.traceAll = function()
    {
        // See issue 6220
        Firebug.Console.log(Locale.$STR("commandline.MethodDisabled"));
        //Firebug.Debugger.traceAll(Firebug.currentContext);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.untraceAll = function()
    {
        // See issue 6220
        Firebug.Console.log(Locale.$STR("commandline.MethodDisabled"));
        //Firebug.Debugger.untraceAll(Firebug.currentContext);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.traceCalls = function(/*fn*/)
    {
        // See issue 6220
        Firebug.Console.log(Locale.$STR("commandline.MethodDisabled"));
        //Firebug.Debugger.traceCalls(Firebug.currentContext, fn);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.untraceCalls = function(/*fn*/)
    {
        // See issue 6220
        Firebug.Console.log(Locale.$STR("commandline.MethodDisabled"));
        //Firebug.Debugger.untraceCalls(Firebug.currentContext, fn);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.copy = function(x)
    {
        System.copyToClipboard(x);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    // xxxHonza: removed from 1.10 (issue 5599)
    /*commands.memoryProfile = function(title)
    {
        Firebug.MemoryProfiler.start(context, title);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };

    commands.memoryProfileEnd = function()
    {
        Firebug.MemoryProfiler.stop(context);
        return Firebug.Console.getDefaultReturnValue(context.window);
    };*/

    return commands;
};

return CommandLineAPI;

});
