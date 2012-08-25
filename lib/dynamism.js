  // For logging objects instead of getting [object Object]
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
dynamism = function() {
  var callbacks = { all: [], addition: [], removal: [] };
  
  function log(m, ctx) { 
    ctx = ctx || "D"; console.log("[" + ctx + "] " + m);
  }

  function foreach(arr, handler) {
    arr = arr || []; for (var i = 0; i < arr.length; ++i) handler(arr[i]);
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
        console.log("Unable to find any parent entity for: " + dump(el));
        return null;
      }

      target = parent;
      // log("Target found implicitly:" + dump(target));
    }
    // console.log("I'm DFing " + target_name + "[" + target_index + "]");

    target = target || $(
        "[data-dyn-entity='" + $.escape(target_name) + "']"
      + "[data-dyn-index=" + target_index + "]");

    if (target.length == 0) {
      log("Target could not be located by: " + dump(el), "E");
      return null;
    }

    return target;
  }

  function swap(source, dest) {
    var raw_entity_id = source.attr("data-dyn-entity");
    var source_id = $.escape(raw_entity_id);

    // Swap the indexes
    var source_idx = source.attr("data-dyn-index");
    var dest_idx = dest.attr("data-dyn-index");

    // console.log("Swapping " + source_idx + " with " + dest_idx);

    var fq_source_id = indexize([ raw_entity_id, source_idx ]);
    var fq_dest_id = indexize([ raw_entity_id, dest_idx ]);

    // Change all occurences of dest_idx to source_idx in the destination's children
    dest.find("*").each(function() {
      var child = $(this);
      $.each($(this).get(0).attributes, function(i, pair) {
        if (pair.name.search(fq_dest_id) > -1)
          console.log("changing attribute '" + pair.name + "' (" + pair.value + ")")

        try {
          child.attr(
            pair.name,
            pair.value.replace(fq_dest_id, fq_source_id));
        } catch (e) {
          // ignore properties that can't be changed
        }
      });

      if (child.attr("data-dyn-substitute") == "index")
        child.html(source_idx);
      if (child.attr("data-dyn-target") == raw_entity_id && child.attr("data-dyn-target-index") == source_idx)
        child.attr("data-dyn-target-index", dest_idx);
    });

    // Change all occurences of source_idx to dest_idx in the source's children
    source.find("*").each(function() {
      var child = $(this);
      $.each($(this).get(0).attributes, function(i, pair) {
        if (pair.name.search(fq_source_id) > -1)
          console.log("changing attribute '" + pair.name + "' (" + pair.value + ")")

        try {
          child.attr(
            pair.name,
            pair.value.replace(fq_source_id, fq_dest_id));
        } catch (e) {
          // ignore properties that can't be changed
        }
      });

      if (child.attr("data-dyn-substitute") == "index")
        child.html(dest_idx);
      if (child.attr("data-dyn-target") == raw_entity_id && child.attr("data-dyn-target-index") == source_idx)
        child.attr("data-dyn-target-index", dest_idx);
    });

    dest.attr("data-dyn-index", source_idx);
    source.attr("data-dyn-index", dest_idx);
  }

  return {
        
    add: function(target) {
      var target_name = null,
          target_index = null;

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

      } else {
        target_name = target.attr("data-dyn-entity");
        target_index = target.attr("data-dyn-index");
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
    
    move_up: function() {
      /**
       * 1. locate the target data-dyn-entity to be moved (source)
       * 2. locate the target's previous sibling (destination)
       * 3. swap indeces
       * 4. prepend the source to the destination
       */

      var raw_entity_id = $(this).attr("data-dyn-target");
      if (!raw_entity_id) {
        raw_entity_id = $(this).parents("[data-dyn-entity]:first").attr("data-dyn-entity");
      }

      var source_id = $.escape(raw_entity_id);


      var source = $(this).parents("[data-dyn-entity=" + source_id + "]:first");
      if (!source || source.length == 0) {
        console.log("dyn_move_up(): source could not be located - " + $(this).attr("data-dyn-target"));
        return false;
      }

      var source_idx = parseInt( source.attr("data-dyn-index") );

      if (source_idx == 0)
        return false;

      // console.log("Moving " + source_id + indexize([ source.attr("data-dyn-index") ]) );

      // var dest = source.prev("[data-dyn-entity=" + source_id + "][data-dyn-index=" + ( source_idx - 1) + "]:first")
      var dest = $("[data-dyn-entity=" + source_id + "][data-dyn-index=" + (source_idx - 1) + "]");

      if (!dest || dest.length == 0) {
        console.log("dyn_move_up(): dest could not be located - " + source_id + indexize([ source_idx ]));
        return false;
      }

      swap(source, dest);

      dest.before(source);

      // disable the move_up button (this) if the source has become the first entity
      var first_entity = $("[data-dyn-entity=" + source_id + "]:not([hidden]):first");
      var is_first_entity = first_entity.attr("data-dyn-index") == source.attr("data-dyn-index");
      $(this).attr({ disabled: is_first_entity });
      // enable the move down button
      source.find("[data-dyn-action='move_down']:first").attr({ disabled: null });

      // now handle the destination's buttons;
      var last_entity = $("[data-dyn-entity=" + source_id + "]:last");
      var is_last_entity = last_entity.attr("data-dyn-index") == dest.attr("data-dyn-index");
      // disable the move down if it has become the last one
      dest.find("[data-dyn-action='move_down']:first").attr({ disabled: is_last_entity });
      // re-enable the move up button because the source is now above it
      dest.find("[data-dyn-action='move_up']:first").attr({ disabled: null });
    }, // dynamism.move_up

    move_down: function() {
      var raw_entity_id = $(this).attr("data-dyn-target");
      if (!raw_entity_id) {
        raw_entity_id = $(this).parents("[data-dyn-entity]:first").attr("data-dyn-entity");
      }
      var source_id = $.escape(raw_entity_id);

      // console.log("Moving " + source_id);

      var source = $(this).parents("[data-dyn-entity=" + source_id + "]:first");
      if (!source || source.length == 0) {
        console.log("dyn_move_up(): source could not be located - " + $(this).attr("data-dyn-target"));
        return false;
      }

      var source_idx = parseInt( source.attr("data-dyn-index") );

      // var dest = source.next("[data-dyn-entity=" + source_id + "][data-dyn-index][data-dyn-index!=-1]:first")
      var dest = $("[data-dyn-entity=" + source_id + "][data-dyn-index=" + (source_idx + 1) + "]");
      if (!dest || dest.length == 0) {
        console.log("dyn_move_up(): dest could not be located - " + source_id);
        return false;
      }

      swap(source, dest);

      dest.after(source);

      // disable the move_down button (this) if the source has become the last entity
      // and re-enable the move up button
      var last_entity = $("[data-dyn-entity=" + source_id + "]:last");
      var is_last_entity = last_entity.attr("data-dyn-index") == source.attr("data-dyn-index");
      $(this).attr({ disabled: is_last_entity });
      source.find("[data-dyn-action='move_up']:first").attr({ disabled: null });

      var first_entity = $("[data-dyn-entity=" + source_id + "]:not([hidden]):first");
      var is_first_entity = first_entity.attr("data-dyn-index") == dest.attr("data-dyn-index");
      // enable the move down button
      dest.find("[data-dyn-action='move_up']:first").attr({ disabled: is_first_entity });
      dest.find("[data-dyn-action='move_down']:first").attr({ disabled: null });
    }, // dynamism.move_down

    bind: function(parent) {
      if (!parent || parent.length == 0)
        parent = $("*");

      parent.find("[data-dyn-target]:not([data-dyn-action]), \
                   [data-dyn-target][data-dyn-action='add']").click(dynamism.add);
      parent.find("[data-dyn-action='remove']").click(dynamism.remove);
      parent.find("[data-dyn-action='move_up']").click(dynamism.move_up);
      parent.find("[data-dyn-action='move_down']").click(dynamism.move_down);
    }, // dynamism.bind

    /**
     * @action can be one of "all", "addition", or "removal"
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
     */
    on_addition: function(cb) { 
      return dynamism.add_callback(cb, "addition");
    },

    /**
     * Registers a method to be called right *before* an 
     * entity is removed.
     */
    on_removal: function(cb) {
      return dynamism.add_callback(cb, "removal");
    },

    after_removal: function(cb) {
      return dynamism.add_callback(cb, "post-removal");
    }

  } // dynamism.return
}();

$(function() {
  // hide all templates (ones with [data-dyn-index = -1])
  $("[data-dyn-entity]:not([data-dyn-index])").attr({ "data-dyn-index": -1 });
  $("[data-dyn-entity][data-dyn-index=-1]").attr({ "hidden": "true" });

  // $("[data-dyn-action='move_up']:visible").each(function() {
    // console.log("moo");
    // var entity_id = $(this).parents("[data-dyn-entity]:first").attr("data-dyn-entity");
    //
  // });
  
  // Disable 'move up' buttons for elements sitting at the top
  // and 'move down' buttons for elements sitting at the bottom
  // TODO: refactor
  $("[data-dyn-index=0]").each(function() {
    $(this).find("[data-dyn-action='move_up']:first").attr({ disabled: true });
    $("[data-dyn-entity=" 
      + $.escape($(this).attr("data-dyn-entity"))
      + "][data-dyn-index!=-1]:last")
    .find("[data-dyn-action='move_down']:first").attr({ disabled: true })
  });

  dynamism.on_addition(function(clone) {
    clone.find("[data-dyn-action='move_down']:first").attr({ disabled: true });
      if (clone.attr("data-dyn-index") != 0)
        clone.prev("[data-dyn-entity]:first").find("[data-dyn-action='move_down']:first").attr({ disabled: null });
      else
        clone.find("[data-dyn-action='move_up']:first").attr({ disabled: true })
  });

  dynamism.on_removal(function(entity) {
    var idx = entity.attr("data-dyn-index");
    var is_last = entity.siblings("[data-dyn-entity]:last").attr("data-dyn-index") == idx - 1;

    if (idx == 0) {
      entity.next("[data-dyn-entity]:first").find("[data-dyn-action='move_up']:first").attr({ disabled: null });
    }
    else if (is_last) {
      var dest = entity.prev("[data-dyn-entity]:first");
      dest.find("[data-dyn-action='move_down']:first").attr({ disabled: true });
      dest.find("[data-dyn-action='move_up']:first").attr({ disabled: null });
    }
  });

  // bind all template buttons
  dynamism.bind($("*"));
  // $("[data-dyn-entity]").each(function() { dyn_refresh_swap_buttons($(this)) });
  // $("[data-dyn-target][data-dyn-action!='remove'], [data-dyn-target][data-dyn-action^='add']").click(dyn_add);
  // $("[data-dyn-target][data-dyn-action='remove']").click(dyn_rem);
});
