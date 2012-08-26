var $;
var jQuery;
if (!$ && !jQuery) {
  throw("jQuery could not be found, dynamism requires it.");
}

dynamism = function() {
  var stages      = [ "all", "addition", "removal", "post-removal", "post-injection" ],
      callbacks   = {},
      injections  = [],
      factories   = {};
  
  // initialize the stage callbacks
  foreach(stages, function(stage) { callbacks[stage] = [] });

  /* -------
   * Utility
   * ------- */
  function log(m, ctx) { 
    ctx = ctx || "D"; console.log("[" + ctx + "] " + m);
  }

  /** For logging objects instead of getting [object Object] */
  var dump;
  if (undefined === dump) {
    dump = function(el) {
      var self = $(el)[0];
      var out = '<' + self.tagName;
      
      if (self.attributes) {
        for (var i = 0; i < self.attributes.length; ++i) {
          var pair = self.attributes[i]
          out += ' ' + pair.name + '="' + pair.value + '"';
        }
      }

      out += ' />';
      return out;
    }
  }
  
  var foreach;
  if (undefined === foreach) {
    function foreach(arr, handler) {
      arr = arr || []; for (var i = 0; i < arr.length; ++i) handler(arr[i]);
    }
  }

  /**
   * Replaces [ and ] with \\\[ and \\\] respectively.
   * This is required for jQuery selectors locating attribute values that
   * contain any bracket
   */
  $.escape = function(str) {
    return str.replace(/\[/g, '\\\[').replace(/\]/g, '\\\]');
  }
  // alias
  var escape_indexes = $.escape;

  /**
   * Joins an array of strings by [].
   * Useful for building a nested ID and usually used with $.escape()
   */
  function indexize(str_arr) {
    if (typeof(str_arr) == "string")
      str_arr = [ str_arr ];
    var str = "";
    for (var i = 0; i < str_arr.length; ++i) {
      if (!str_arr[i] || str_arr[i] == "")
        continue;

      str += '[' + str_arr[i] + ']';
    }
    return $.escape(str);
  }

  /**
   * Attempts to locate a dynamism entity based on the given
   * element's @data-dyn-target attribute, or if not found
   * will traverse the ancestry chain until an element with
   * the @data-dyn-entity attribute is found.
   *
   * @param el if not set, $(this) is assumed
   *
   * @return null if the target could not be found
   * @return $(target)
   */
  function locate_target(el) {
    var target = null;
    var target_name = $(el).attr("data-dyn-target");
    var target_index = $(el).attr("data-dyn-target-index");

    // An implicit relationship with the entity is assumed;
    // we will look for the first data-dyn-entity up the
    // DOM and use it as the target
    if (!target_name) {
      var parent = $(el).parents("[data-dyn-entity]:not([data-dyn-index=-1]):first");
      if (parent.length == 0) {
        log("Unable to find any parent entity for: " + dump(el), "E");
        return null;
      }

      target = parent;
      // log("Target found implicitly:" + dump(target), "N");
    }

    target = target ||
      $("[data-dyn-entity='" + $.escape(target_name) + "']" +
        "[data-dyn-index=" + target_index + "]");

    if (target.length == 0) {
      log("Target could not be located by: " + dump(el), "E");
      return null;
    }

    return target;
  }

  /**
   * Substitutes all occurences of the "reference" (see note below)
   * with the injection value, @value. The substitution can either
   * be a full replacement, or a partial one when wildmarks are used.
   *
   * For example, the following node will have its @href attribute 
   * injected with the `id` key's value _only_ where %id is placed.
   * However, its text() node will be emptied and replaced with `label`:
   *
   * @code
   *  <a href="/posts/%id" data-dyn-inject="@href, id, @text, label">
   *    This will be erased.
   *  </a>
   * @endcode
   *
   * @note The reference is built either using the @key, or is composed
   *       of the context (__ctx.join('.')) and suffixed by the @key.
   *
   * @note The substitution is not limited to one node, but will
   *       be performed on all the nodes that match the conditions.
   */
  function substitute(key, value, el, __ctx) {
    // build up the reference that the attribute value must match
    var reference = __ctx.length > 0
      ? __ctx.join('.') + '.' + key
      : key;

    // log("\tInjecting value: " + value + " in context: " + __ctx);

    // We need to locate the target(s) now
    reference = $.escape(reference);
    var targets = el.find('[data-dyn-inject]:visible').filter(function() {
      return $(this).attr("data-dyn-inject").trim().match(RegExp('@\\\S+,\\\s*' + reference));
    });

    targets.each(function() {
      var target = $(this);

      // Find out whether we're injecting into an attribute or 
      // the target's inner text() node
      var parts = target.attr("data-dyn-inject").trim().split(/,\s*/);

      // assert proper syntax (each node must map to an injection)
      if (parts.length % 2 != 0) {
        // yes, alert, this is a programmer mistake
        alert("Syntax error: " + parts.join(' ') + " are not even!");
        return false;
      }

      var nr_attrs = parts.length / 2;
      for (var j = 0; j < parts.length; j += 2) {
        
        // Is not interested with the current injection
        if (parts[j+1] != reference) {
          continue;
        }
        // Has already been injected
        else if (is_injected(target, parts[j], reference)) {
          log("this element has already been injected with " + 
              parts[j] + " for " + reference + ", skipping", "N");

          continue;
        }

        // the attribute or text node we will be injecting into
        var node = parts[j].substr(1 /* trailing @ */);

        // log(node + " => " + value + " #" + reference);

        // Now we perform the actual substitution:
        // 1. handle text() nodes
        if (node == 'text') {
          // substitute the wildmark(s)
          if (target.html().search('%' + key) != -1) {
            target.html(target.html().replace(RegExp('%' + key, "g"), value));
          }
          // no wildmarks used, replace the whole value
          else {
            target.html(value);
          }
        }
        // 2. and @attributes
        else {
          var attr_value = target.attr(node);
          // like text() above, substitute wildmarks if any
          if (attr_value && attr_value.search('%' + key) != -1) {
            var replacement = RegExp('%' + key, "g");
            target.attr(node, attr_value.replace(replacement, value));
          }
          // or replace/create the attribute value
          else {
            target.attr(node, value);                      
          }                    
        } // dest is an @attribute

        track_injection(target, '@' + node, reference);
      } // injection parts loop
    }); // targets loop

    if (targets.length == 0) {
      log("Could not find any entity referencing: " + reference, "E");
    }
  } // substitute()

  /** Helper used internally by is_injected() and track_injection() */
  function __injection_id(node, reference) { return node + ' ' + reference; }

  /** Returns true if @element has had its @node injected by @reference. */
  function is_injected(element, node, reference) {
    for (var i = 0; i < injections.length; ++i) {
      var entry = injections[i];
      if (element.is(entry.o)) {
        if (entry.injections.search(__injection_id(node, reference)) != -1)
          return true;
      }
    }

    return false;
  } // is_injected()

  /** Nodes will not be injected more than once for every @reference and @node pair. */
  function track_injection(element, node, reference) {
    var found = false;
    for (var i = 0; i < injections.length; ++i) {
      var entry = injections[i];
      if (element.is(entry.o)) {
        entry.injections += __injection_id(node, reference);
        found = true;
        break;
      }
    }

    if (!found) {
      injections.push({ o: element, injections: __injection_id(node, reference) });
    }
    log("Injection: " + reference + " into " + node)
  } // track_injection()

  return {
        
    add: function(target) {
      var target_name = null,
          target_index = null;

      if (target) {
        try {
          target = $(target);
          target_name = target.attr("data-dyn-entity");
          target_index = target.attr("data-dyn-index");

          if (!target_name || !target_index) {
            throw "Invalid target, has no identity or index";
          }

        } catch(e) {
          log(e);
          target = null;
        }
      }

      if (!target) {
        target_name   = $(this).attr("data-dyn-target");
        target_index  = $(this).attr("data-dyn-target-index") || -1;

        // console.log("I'm DFing " + target_name + "[" + target_index + "]");

        target = $("[data-dyn-entity='" + $.escape(target_name) + "']" +
                   "[data-dyn-index=" + target_index + "]");

        if (target.length == 0) {
          log("Unable to find entity. Invalid reference by: " + dump($(this)));
          return false;
        }

      }

      // determine the next index (based on the last entry's index)
      var last_entry = $("[data-dyn-entity='" + $.escape(target_name) + "']:last");
      var next_index = parseInt(last_entry.attr("data-dyn-index")) + 1;

      // console.log("Next index: " + next_index)

      // do the actual cloning
      var clone = target.clone();
      clone.attr({  "hidden": null, "data-dyn-index": next_index });

      // Now we need to adjust all references by the children to this entity:
      // the reference will look like [my_name][-1] in any of the attributes.
      // It needs to reflect the actual index (next_index)
      var __orig_parent_name = RegExp(escape_indexes(target_name + '[-1]'), "g");
      var __real_parent_name = target_name + "[" + next_index + "]";
      clone.find("*").each(function() {
        var child = $(this);
        $.each(child.get(0).attributes, function(i, pair) {
          try {
            child.attr(
              pair.name,
              pair.value.replace(__orig_parent_name, __real_parent_name));
          } catch (e) {
            // ignore properties that can't be changed
            // log("Property " + pair.name + " can't be changed!")
          }
        });

        // if the child points to us, adjust the pointing index
        if (child.attr("data-dyn-target") == target_name) {
          // inject the parent index into IMMEDIATE children that ask for it
          if (child.attr("data-dyn-inject") == "index") {
            child.html(next_index);
          }

          child.attr("data-dyn-target-index", next_index);
        }
      });

      clone.find("[data-dyn-inject=index]:not([data-dyn-target])").each(function() {
        var child = $(this);
        if (child.parents("[data-dyn-entity]:first").attr("data-dyn-entity") == clone.attr("data-dyn-entity"))
          child.html(next_index);
      })

      dynamism.bind(clone);

      // target.parent().append(clone);
      $("[data-dyn-entity=" + $.escape(target_name) + "]:last").after(clone);
      // target.after(clone);

      foreach(callbacks["addition"], function(cb) { cb(clone); });
      foreach(callbacks["all"],      function(cb) { cb(clone, "addition"); });

      return clone;
    }, // dynamism.add

    remove: function() {
      var target = locate_target($(this));

      if (!target)
        return false;

      foreach(callbacks["removal"], function(cb) { cb(target); });
      foreach(callbacks["all"],     function(cb) { cb(target, "removal"); });

      target.remove();

      foreach(callbacks["post-removal"],  function(cb) { cb(null); });
      foreach(callbacks["all"],           function(cb) { cb(null, "post-removal"); });

    }, // dynamism.remove
    
    inject: function(feed, el, __ctx) {
      var __ctx = __ctx || [];
      var initial = false;
      if (__ctx.length == 0) {
        initial = true;
      }

      // console.log(feed);
      for (var key in feed) {
        var value = feed[key];
        // console.log(typeof(key) + " => " + typeof value);
        // console.log(key + " => " + value);
        switch(typeof value) {
          case "string":
          case "number":
            substitute(key, value, el, __ctx);
            break;
          case "object":
            // it's an object, not an array, so we update the
            // context and proceed with injection normally
            if (isNaN(parseInt(key))) {
              __ctx.push(key);
              log("Context: " + __ctx);
              dynamism.inject(value, el, __ctx);
              __ctx.pop();
            }
            // it's an array of objects, we will look if there's
            // any factory method registered for this kind of objects
            // and if there is, we create an element and inject that
            else {
              var model = __ctx.join('.');
              var new_el = null;
              var factory = factories[model];

              log("Looking for a factory for " + model)
              // is there user-defined factory?
              if (factory) {
                log("\tUsing user-defined factory for: " + model);
                new_el = factory(el);
              }
              // look for a template node
              else {
                log("\tLooking for a factory for model: " + model);

                var tmpl = el.find("[data-dyn-spawn-on='" + model +"'][data-dyn-index=-1]");
                if (tmpl.length == 1) {
                  log("\t\tFound one!")
                  new_el = dynamism.add(tmpl);
                }
              }

              if (new_el) {
                dynamism.inject(value, new_el, __ctx);

                // invoke any injection hooks attached to this element
                if (new_el.attr("data-dyn-hook")) {
                  foreach(callbacks["post-injection"],  function(cb) { cb(new_el); });
                  foreach(callbacks["all"],             function(cb) { cb(new_el, "post-injection"); });                  
                }
              } else {
                log("Unable to create model: " + model + ", no factory found.", "W");
              }
            
            }
            break;
          default:
            console.log("Unknown value type: " + typeof(value));
        }
      }

      // we're done injecting
      if (initial) {
        foreach(callbacks["post-injection"],  function(cb) { cb(el); });
        foreach(callbacks["all"],             function(cb) { cb(el, "post-injection"); });
      }
    }, // dynamism.inject

    bind: function(parent) {
      if (!parent || parent.length == 0)
        parent = $("*");

      parent.find("[data-dyn-target]:not([data-dyn-action]), \
                   [data-dyn-target][data-dyn-action='add']").click(dynamism.add);
      parent.find("[data-dyn-action='remove']").click(dynamism.remove);

      // hooks built from the @data-dyn-hooks attribute
      // syntax: data-dyn-hooks="([,]STAGE, METHOD_ID)+"
      var autohooks = function(el) {
        // log("Autohooking")
        var child = el || $(this);
        var captures = child.attr("data-dyn-hook").match(/(.*),\s*(.*)/);
        var stage = captures[1],
            method = captures[2];

        if (stage && method) {
          if (typeof method == "string" && typeof window[method] == "function") {
            dynamism.add_callback(function(el) {
              // log("Checking if " + dump(child) + " is " + dump(el));
              if (child.is(el)) {
                return window[method](el);
              }

              return true;
            }, stage);
          }
        } else {
          log("Invalid stage or method: " + stage + " => " + method, "E");
        }
      };

      // hook children
      parent.find("[data-dyn-hook]:visible").each(autohooks);
      // and the current element
      if (parent.attr("data-dyn-hook"))
        autohooks(parent);

    }, // dynamism.bind

    /**
     * @action can be one of "all", "addition", or "removal"
     *
     * All callbacks receive two arguments: the element (if applicable),
     * and the stage (see @dynamism.stages)
     */
    add_callback: function(cb, action) {
      var action = action || "all";
      callbacks[action].push(cb);
    }, // dynamism.add_callback

    /**
     * Registers a method to be called when an entity
     * has been cloned and added.
     *
     * This is handy for installing bindings for elements
     * contained in the entity if needed.
     *
     * Callback will receive the element for the first argument.
     */
    on_addition: function(cb) { 
      return dynamism.add_callback(cb, "addition");
    },

    /**
     * Registers a method to be called right *before* an 
     * entity is removed.
     *
     * Callback will receive the element for the first argument.
     */
    on_removal: function(cb) {
      return dynamism.add_callback(cb, "removal");
    },

    /**
     * Callback will receive null for an element!
     */
    after_removal: function(cb) {
      return dynamism.add_callback(cb, "post-removal");
    },

    /**
     * Callback will receive the injected element. Called
     * after an element has been fully injected (its registered
     * feed has been fully parsed.)
     *
     * To validate the identity of a *certain* injected element,
     * use jQuery's is():
     * @code
     *  function my_cb(el) {
     *    if ($("some_selector").is(el)) {
     *      // OK, this is the element that you want
     *    }
     *  }
     * @endcode
     */
    after_injection: function(cb) {
      return dynamism.add_callback(cb, "post-injection");
    },

    register_factory: function(model, factory) {
      if (factories[model]) {
        alert("Seems like you've already registered a factory for: " + model);
        return false;
      }

      if (typeof factory != "function") {
        alert("Factory must be a method that creates an \
              object, given was: " + typeof(factory) + " for model: " + model);
        return false;
      }

      factories[model] = factory;
      log("Registered factory for: " + model);
    }

  } // dynamism.return
}();

$(function() {
  // hide all entity templates (ones with [data-dyn-index = -1] or none at all)
  $("[data-dyn-entity]:not([data-dyn-index])").attr({ "data-dyn-index": -1 });
  $("[data-dyn-entity][data-dyn-index=-1]").attr({ "hidden": "true" });

  /**
   * Remove all the injection attributes from the newly injected nodes.
   * This isn't really "required", it only makes the markup less cluttered
   */
  var __injection_attributes_to_cleanup
  = [ "data-dyn-inject", "data-dyn-spawn-on", "data-dyn-hook" ];
  dynamism.after_injection(function(el) {
    for (var i = 0; i < __injection_attributes_to_cleanup.length; ++i) {
      var attr = __injection_attributes_to_cleanup[i];
      el.find("[" + attr + "]:visible").attr(attr, null);
      el.attr(attr, null);
    }
  });

  /** Bind all template buttons */
  dynamism.bind($("*"));
});
