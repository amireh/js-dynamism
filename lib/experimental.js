/** ---- EXPERIMENTAL ---- */
edynamism = function() {

  /** ---- EXPERIMENTAL ----
    * Swaps the elements @source and @dest while making the 
    * appropriate adjustments to their data-dyn-index
    * attributes (and their children's).
    *
    * Side-effects:
    * => the DOM position of @source and @dest will be swapped
    * => all occurences of source[data-dyn-index] in the source
    *    and its children will be swapped with dest[data-dyn-index]
    * => children with [data-dyn-substitute=index] will have their
    *    text() node replaced by the swapped index
    */
  function swap(source, dest) {
    var raw_entity_id = source.attr("data-dyn-entity");
    var source_id = $.escape(raw_entity_id);

    // Swap the indexes
    var source_idx = source.attr("data-dyn-index");
    var dest_idx = dest.attr("data-dyn-index");

    if (!source_idx || !dest_idx) {
      log("Invalid swap nodes, one of them doesn't have an index!", "E");
      return false;
    }

    // console.log("Swapping " + source_idx + " with " + dest_idx);

    var fq_source_id = indexize([ raw_entity_id, source_idx ]); // fq for fully-qualified
    var fq_dest_id = indexize([ raw_entity_id, dest_idx ]);

    var adjust_attributes = function(child, from_id, to_id, from_idx, to_idx) {
      var child = child || $(this);
      $.each(child.get(0).attributes, function(i, pair) {
        if (pair.name.search(from_id) > -1)
          console.log("changing attribute '" + pair.name + "' (" + pair.value + ")")

        try {
          child.attr(pair.name, pair.value.replace(from_id, to_id));
        } catch (e) {
          // ignore properties that can't be changed
        }
      });

      if (child.attr("data-dyn-substitute") == "index")
        child.html(to_idx);

      if (child.attr("data-dyn-target") == raw_entity_id &&
          child.attr("data-dyn-target-index") == from_idx)
        child.attr("data-dyn-target-index", to_idx);
    }
    // Change all occurences of dest_idx to source_idx in the destination's children
    dest.find("*").each(function() {
      adjust_attributes($(this), fq_dest_id, fq_source_id, dest_idx, source_idx);
    });
    source.find("*").each(function() {
      adjust_attributes($(this), fq_source_id, fq_dest_id, source_idx, dest_idx);
    });

    dest.attr("data-dyn-index", source_idx);
    source.attr("data-dyn-index", dest_idx);
  }

  return: {

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

  }
}

$(function() {
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

  /**
   * Re-evaluate the disabled state of movement buttons after
   * an entity is added or removed, so the entity that's now in the top
   * will have its 'move-up' button disabled, the bottomly one
   * will have its 'move-down' button disabled.
   */
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

  dynamism.on_addition(function(entity) {
    entity.find("[data-dyn-action='move_up']").click(edynamism.move_up);
    entity.find("[data-dyn-action='move_down']").click(edynamism.move_down);
  });
});