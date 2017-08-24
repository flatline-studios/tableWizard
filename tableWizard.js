/** 
 *  Table Wizard Plugin definition.
 *  
 *  Author  : Kerry Taylor
 *  Version : 0.9
 *  Date    : 24/08/2017
 *  
 *  Turns an HTML table into a fully responsive one, as well as integrates some other goodies.
 *  
 *  # Dependencies    (REQUIRED)
 *    - JQuery 3.x and above
 *    - GSAP
 *
 *  # Dependencies    (OPTIONAL)
 *    - moreInfoPopup
 *    - sticky-kit
 *  
 *  @args
 *    columnHeaderSelector  : An identifier that all column headers possess.
 *    rowHeaderSelector     : An identifier that all row headers possess.
 *    options               : An object containing the settings for the plugin.
 *  
 *  @properties
 *    
 *  
 *  @methods
 *    
 *  
 */

// Create Closure.
(function($) {
  
  // Plugin definition.
  $.fn.tableWizard = function(columnHeaderSelector, rowHeaderSelector, options) {
    
    // TODO: Organise the z-indexes of the elements based around a given base z-index given in the settings.
    //       Then just +/- x from it, for each element that needs it set, so that they're all relative.
    
    // Creates the settings for this INSTANCE of the tableWizard.
    var settings = $.extend(true, {}, $.fn.tableWizard.defaults, options);
    
    // Saves the table(s) that the plugin is being used on.
    var $table = this;
    
    // Grabs whether or not sticky headers are enabled.
    var stickyHeadersEnabled = (settings.stickyKit !== null && typeof settings.stickyKit === 'object') ? true : false;
    
    // // Grabs whether the touchmove functionality should be enabled.
    // var touchMoveEnabled = (settings.touchMove !== null && typeof settings.touchMove === 'object') ? true : false;

    // Adds additional items to the settings, for convenience and cacheability.
    settings.navButtons._wrapper = '.' + settings.navButtons.wrapper;
    settings.navButtons._buttons = '.' + settings.navButtons.buttons;
    settings.navButtons._prev = '.' + settings.navButtons.prev;
    settings.navButtons._next = '.' + settings.navButtons.next;
    settings.table._outerWrapper = '.' + settings.table.outerWrapper;
    settings.table._overflowWrapper = '.' + settings.table.overflowWrapper;
    if (stickyHeadersEnabled) {
      settings.stickyKit._wrapper = '.' + settings.stickyKit.wrapper;
      settings.stickyKit._innerWrapper = '.' + settings.stickyKit.innerWrapper;
      settings.stickyKit._elements = '.' + settings.stickyKit.elements;
    }
    
    // Creates the helper objects.
    // Called from a function, as the DOM elements might not exist yet.
    var createHelpers = function() {
      settings.navButtons.$wrapper = $(settings.navButtons._wrapper);
      settings.navButtons.$buttons = $(settings.navButtons._buttons);
      settings.navButtons.$prev = $(settings.navButtons._prev);
      settings.navButtons.$next = $(settings.navButtons._next);
      settings.table.$outerWrapper = $(settings.table._outerWrapper);
      settings.table.$overflowWrapper = $(settings.table._overflowWrapper);
    }
    
    // Creates the helper objects for the sticky headers.
    // Called from a separate function, as the sticky DOM elements are generated separately.
    var createStickyHelpers = function() {
      settings.stickyKit.$wrapper = $(settings.stickyKit._wrapper);
      settings.stickyKit.$innerWrapper = $(settings.stickyKit._innerWrapper);
      settings.stickyKit.$elements = $(settings.stickyKit._elements);
    }
    
    
    
    // INSTANCE VARIABLES
    //
    // The total number of columns in the table.
    var totalNumOfCols;

    // A jQuery collection of all the elements that are moveable.
    var $scrollableElements;

    // The number of desired scrollable columns.
    var numOfScrollableCols;

    // The scrollable columns location.
    var colLocation;
    
    // As objects literals don't ensure a specific order, but arrays do, we create an array
    // out of the keys of the number of scrollable columns object. Then sort the array in ascending
    // numerical order.
    var sortedKeysOfNumOfScrollableColsObj = [];
    
    // The width of the outer table wrapper.
    var outerWrapperWidth;
    
    // The width, as a percentage, that each column should be, relative to the width of the table.
    var widthOfColAsPercentage;
    
    var detachedStickyElement;
    
    // If touchMove is enabled.
    if (settings.touchMove) {
      
      // Stores the starting x co-ordinate for the touch event.
      var startXPosition;
      
      // Stores the decimalised percentage of the table cell that has been touchmoved.
      var xMovementAsADecimal;
      
      // The previous x co-ordinate of the scrollable elements position.
      var lastXPosition;
      
      // The total difference of x co-ordinate from touchstart to touchend. 
      var runningTotalOfX = 0;
    }
    
    
    
    // GETTERS (sort of...)
    //
    // Returns the total number of columns in the table.
    var getTotalNumOfCols = function() {
      
      var totalNumOfCols = 0;
      
      // Loops through every row with a header, finding the number of columns in each,
      // returning the largest.
      $table
        .find(rowHeaderSelector)
        .each(function(i, e) {
        
          var curNumOfCols = $(e).siblings().addBack().length;
        
          if (curNumOfCols > totalNumOfCols) {
            totalNumOfCols = curNumOfCols;
          }
        
        });
      
      return totalNumOfCols;
      
    }
    
    // Returns the scrollable elements as a JQuery collection.
    var getScrollableElements = function() {
      
      // Creates empty jQuery object.
      var $scrollableElements = new jQuery();
      
      // Adds the scrollable elements to the collection.
      $table
        .find(rowHeaderSelector)
        .each(function(i, e) {
          // TODO: Modify this so it takes a maximum value of the slice, so the navigatable part of the table can be
          //       some central part (i.e., headers on the left AND right).
          $scrollableElements = $scrollableElements.add(
            $(e).siblings().addBack().slice(settings.table.scrollableColFirstIndex)
          );
        });
      
      // Returns the resulting collection.
      return $scrollableElements;
      
    }
    
    // Returns what the current number of scrollable columns should be.
    var getNumOfScrollableCols = function() {
      
      // If the scrollable columns have been defined in the settings.
      if (sortedKeysOfNumOfScrollableColsObj.length !== 0) {
        
        // Grabs the width of the outerWrapper, to decide which defined breakpoint the table currently falls in to.
        // outerWrapperWidth = settings.table.$outerWrapper.width();
        var result = 0;
        
        // Loops through each of the breakpoints defined, but with the sorted array of keys.
        $.each(sortedKeysOfNumOfScrollableColsObj, function(key, value) {
          
          // If the current width is less than the ordered breakpoint width,
          // then assume that the value associated with this breakpoint in the object literal is the
          // correct number of columns.
          if (outerWrapperWidth <= value) {
            
            // Saves the result value.
            result = settings.table.numOfScrollableCols[value];
            
            // Exits the each loop.
            return false;
          }
          
        });
        
        // Otherwise, if a match isn't found in the above loop, then the current width must be larger
        // than all the given breakpoints, so the plugin should be disabled, as it isn't responsive anymore.
        return result;
        
      // If the numOfScrollableCols setting isn't an object, then just return whatever value it holds
      // (most likely, 0, from the default).
      } else {
        
        return settings.table.numOfScrollableCols;
        
      }
      
    }
    
    // Returns the width, as a percentage, that each column should be,
    // relative to the width of the table.
    var getWidthOfColAsPercentage = function(newNumOfScrollableCols) {
      
      // If newNumOfScrollableCols isn't given, then use the instance variables' value.
      if (newNumOfScrollableCols == null) {
        newNumOfScrollableCols = numOfScrollableCols;
      }
      
      return (100 / (newNumOfScrollableCols + (totalNumOfCols - settings.table.totalNumberOfScrollableCols)));
    }
    
    
    
    // PRIVATE METHODS
    //
    // Creates the outer wrapper, that contains all these goodies.
    var createOuterWrapper = function() {
      
      var $outerWrapper = $table.closest(settings.table._outerWrapper);
      
      // Puts a wrapper around the table, to contain everything.
      //    e.g., the overflow fix, the more info popup, the sticky headers, etc.
      // Alternatively, if the wrapper already exist, ensure that it has its style set, as this div might
      // already exist in the page markup.
      if ($outerWrapper.length === 0) {
        $table.wrap($('<div/>', {'class': settings.table.outerWrapper, 'style': 'position: relative; overflow-y: visible;'}));
      } else {
        $outerWrapper.css({
          'position': 'relative',
          'overflow-y': 'visible',
        });
      }
    }
    
    // Creates the navigation buttons.
    var createButtons = function() {
      
      // Grabs the navigation wrapper, to see if it exists.
      var $navButtonsWrapper = $table.parent().siblings(settings.navButtons._wrapper);
      
      // Checks that the navigation buttons haven't already been created,
      // and then creates them.
      if ($navButtonsWrapper.length === 0) {
        
        $table
          .before($('<div/>', {
            'class': settings.navButtons.wrapper,
          })
            .append($('<button/>', {
              'class': settings.navButtons.buttons + ' ' + settings.navButtons.prev,
              type: 'button',
              html: settings.navButtons.prevHTML,
            })
            )
            .append($('<button/>', {
              'class': settings.navButtons.buttons + ' ' + settings.navButtons.next,
              type: 'button',
              html: settings.navButtons.nextHTML,
            })
            )
          );
        
      }
    }
    
    // Creates the overflow fix wrapper.
    var createOverflowWrapper = function() {
      
      // Puts a wrapper around the table, to solve the overflow issue.
      /* https://stackoverflow.com/questions/6421966/css-overflow-x-visible-and-overflow-y-hidden-causing-scrollbar-issue */
      // Also checking that it only gets created once, and/or that it doesn't already exist.
      if (!$table.parent().hasClass(settings.table.overflowWrapper)) {
        $table.wrap($('<div/>', {
          'class': settings.table.overflowWrapper,
          'style': 'position: relative; overflow: hidden;'
        }));
      }
    }
    
    // Creates the sticky headers.
    var createStickyHeaders = function() {

      // Creates a wrapper for the sticky headers to live in.
      // Without this wrapper, there is no good way to get the fixed elements to live inside of the
      // overflow hidden container...
      var $stickyHeaderElements =
          $('<div/>', {
            'class': settings.stickyKit.wrapper,
            'style': 'position: absolute; overflow: hidden; top: 0; right: 0;',
          });
      
      // Creates
      $stickyHeaderElements.append(
          $('<div/>', {
            'class': settings.stickyKit.innerWrapper,
          })
        );
      
      // Creates a new set of matching div headers, that have the same content as the existing table headers. 
      $scrollableElements.filter(columnHeaderSelector).each(function() {

        $stickyHeaderElements.find(settings.stickyKit._innerWrapper).append(
          $('<div/>', {
          'class': settings.stickyKit.elements,
          'style': 'display: inline-block; position: relative; top: 0; box-sizing: border-box;',
          html: $(this).html(),
          })
        );

      });

      // Inserts the set of sticky-header elements just before the table.
      $table.before($stickyHeaderElements);
    }
    
    // Initialises the sticky headers.
    var initStickyHeaders = function() {
      
      // Makes the sticky header wrapper stick to its parent.
      settings.stickyKit.$wrapper.stick_in_parent({
        spacer: false,
      });
      
      // Adds the sticky header elements to the collection of scrollable elements.
      $scrollableElements = $scrollableElements.add(settings.stickyKit.$elements);
      
      // Sets the percentage widths of the header elements.
      settings.stickyKit.$elements.outerWidth(100 / settings.table.totalNumberOfScrollableCols + '%');
      
    }
    
    
    
    // PUBLIC METHODS
    //
    // Check if either of the buttons should be disabled/enabled.
    this.updateButtons = function() {                   // (colLocation, totalNumOfCols, numOfScrollableCols) {
      
      // Assume that all buttons should be enabled initially, ~then~ test them.
      settings.navButtons.$buttons.prop('disabled', false);

      // If the leftmost visible column is the first column, disable the previous button.
      if (colLocation < 1) {
        settings.navButtons.$prev.prop('disabled', true);
      }

      // If the rightmost visible column is the last column, disable the next button.
      if ((colLocation + 1) >= (totalNumOfCols - numOfScrollableCols)) {
        settings.navButtons.$next.prop('disabled', true);
      }
    };

    // Moves the moveable columns to the correct location, and updates the colLocation instance
    // variable, if one is given.
    this.moveColumns = function(newColLocation, instant) {
      
      // D3BUGGER - M00
      // If newColLocation is a number, update colLocation to the newColLocation value,
      // Otherwise, we'll just use the colLocation instance variable for the rest of the function.
      if (!isNaN(newColLocation)) {
        colLocation = newColLocation;
      }
      
      // If instant is null or undefined, then assume it's false.
      if (instant == null) {
        instant = false;
      }
      
      // Identifies whether or not the last column is out of range (if there will be any
      // empty columns at the end, and if so, adjusts the colLocation so that it's in view.
      if ((colLocation + numOfScrollableCols) > settings.table.totalNumberOfScrollableCols) {
        colLocation = settings.table.totalNumberOfScrollableCols - numOfScrollableCols;
      }

      // Either sets or animates the column movements, depending on the instant argument.
      if (instant) {
        TweenMax.set($scrollableElements, {
          xPercent: -colLocation * 100,
        });
      } else {
        TweenMax.to($scrollableElements, settings.animation.speed, {
          xPercent: -colLocation * 100,
        });
      }
    }
    
    // Refactor the table to take into account the new number of scrollable columns.
    this.refactorTable = function(newNumOfScrollableCols) {
      
      // If newNumOfScrollableCols isn't given, then use the instance variables' value.
      if (newNumOfScrollableCols == null) {
        newNumOfScrollableCols = numOfScrollableCols;
      }
      
      // If the tables functionality should be disabled, reset any changes made.
      if (newNumOfScrollableCols === 0) {
        
        // Resets the width of the table and removes the forced fixed layout.
        $table.css('table-layout', '').width('');
        
        // Resets the width of the table columns.
        $table.find(columnHeaderSelector).width('');
        
        // Clears the transforms off of the moveable elements.
        $scrollableElements.css('transform', '');
        
        // Hides the navigation buttons.
        settings.navButtons.$wrapper.hide();
        
        // Effectively disables the default overflow fix wrapper styles, so it doesn't affect the native
        // position sticky on the table header.
        settings.table.$overflowWrapper.css({
          'position': '',
          'overflow': '',
        });
        
        // Detaches (as opposed to removes) the sticky header wrapper and all of its content.
        // TODO: This needs sorting...
        // $('.sticky-header-wrapper').detach();
        
        // If sticky headers are enabled...
        if (stickyHeadersEnabled) {
          
          // Hide the sticky wrapper.
          settings.stickyKit.$wrapper.hide();
          // detachedStickyElement = settings.stickyKit.$wrapper.detach();
        }
        
        
        // If the touchMove functionality is enabled...
        if (settings.touchMove) {
          
          // Disable the touch events.
          $scrollableElements.off('touchstart.tableWizardNavTouchStart');
          $scrollableElements.off('touchstart.tableWizardNavTouchMove');
          $scrollableElements.off('touchstart.tableWizardNavTouchEnd');
        }
        
      } else {
        
        // Calculates the percentage width that each column should be, relative to the width of the table.
        widthOfColAsPercentage = getWidthOfColAsPercentage(newNumOfScrollableCols);
        
        // Sets the width of the nav button wrapper.
        settings.navButtons.$wrapper.width(newNumOfScrollableCols * widthOfColAsPercentage + '%');
        
        // Sets the width of the table, and ensures that it's layout is fixed.
        $table.css('table-layout', 'fixed').width(totalNumOfCols * widthOfColAsPercentage + '%');
        
        // Sets the width of the table columns.
        $table.find(columnHeaderSelector).width(widthOfColAsPercentage + '%');
        
        // Shows the navigation buttons.
        settings.navButtons.$wrapper.show();
        
        // Re-applies (if necessary) the default overflow behaviour of the overflow fix wrapper.
        settings.table.$overflowWrapper.css({
          'position': 'relative',
          'overflow': 'hidden'
        });
        
        // If sticky headers are enabled...
        if (stickyHeadersEnabled) {
          
          // Show the sticky wrapper, and apply some basic styles to it...
          // These styles need to be applied because the event handlers for the sticky kit
          // keep working, even if the sticky wrapper is detached. Then, when it gets
          // re-attached, it can't work out where the top is again properly.
          // TODO: There's probably a more elegent fix for this.
          settings.stickyKit.$wrapper.show().css({
            'position': 'absolute',
            'top': '0',
            'right': '0',
          });
          // settings.table.$overflowWrapper.prepend(detachedStickyElement);
          
          // Adjust the width of the sticky wrapper.
          settings.stickyKit.$wrapper.width(newNumOfScrollableCols * widthOfColAsPercentage + '%');
          
          // Sets the percentage width of the inner sticky wrapper.
          settings.stickyKit.$innerWrapper.width(
            ((100 * settings.table.totalNumberOfScrollableCols) / newNumOfScrollableCols)
              + '%');
          
        }
        
        // If the touchMove functionality is enabled.
        if (settings.touchMove) {
          
          // Touch start event handler.
          $scrollableElements.on('touchstart.tableWizardNavTouchStart', navTouchStartHandler);
          
          
          // Touch move event handler.
          $scrollableElements.on('touchmove.tableWizardNavTouchMove', navTouchMoveHandler);


          // Event that fires at the end of the touch move event.
          $scrollableElements.on('touchend.tableWizardNavTouchEnd', navTouchEndHandler);
          
        }
        
      }
      
    }
    
    
    
    // PLUGIN INITIALISATION
    //
    // Sets up everything, a constructor basically.
    //
    // NOTE: if the numOfScrollableCols is set to 0, effectively disable all functionality.
    var init = function() {
      
      // CREATE DOM ELEMENTS
      //
      // Creates the outer wrapper.
      createOuterWrapper();
      
      // Creates the navButtons.
      createButtons();
      
      // Creates the overflow fix wrapper.
      createOverflowWrapper();
      
      
      
      // HELPERS
      //
      // Creates some additional object references in the settings.
      createHelpers();
      
      
      
      // INSTANCE VARIABLE ASSIGNMENTS
      //
      // Grabs the width of the outerWrapper, to decide which defined breakpoint the table currently falls in to.
      outerWrapperWidth = settings.table.$outerWrapper.width();
      
      // Gets the total number of columns in the table.
      totalNumOfCols = getTotalNumOfCols();

      // Creates a jQuery collection of all the elements that are moveable.
      $scrollableElements = getScrollableElements();
      
      // If the scrollable columns have been defined in the settings, then populate the sorted array of its keys.
      //    (used in the getNumOfScrollableCols() method)
      if (settings.table.numOfScrollableCols !== null && typeof settings.table.numOfScrollableCols === 'object') {
        sortedKeysOfNumOfScrollableColsObj = Object
          .keys(settings.table.numOfScrollableCols)
          .sort(function(a, b) {
            return a - b;
          });
      }

      // Sets the number of desired scrollable columns.
      numOfScrollableCols = getNumOfScrollableCols();
      
      // Sets the percentage width that each column should be, relative to the width of the table.
      widthOfColAsPercentage = getWidthOfColAsPercentage();
      
      // Stores the first scrollable columns location, relative to the leftmost edge.
      // As a result, this is always going to be <= 0.
      colLocation = 0;
      
      
      
      // STICKY HEADERS
      // 
      // Creates the sticky header related stuff, if enabled.
      if (stickyHeadersEnabled) {
        
        // Creates the sticky headers in the DOM.
        createStickyHeaders();
        
        // Creates the sticky header helper objects.
        createStickyHelpers();
        
        // Initialises the sticky header, as well as adding any newly created sticky elements to
        // the scrollable elements collection.
        initStickyHeaders();
      }
      
      // Refactors the table to represent the given number of scrollable columns.
      $table.refactorTable();
      
      // If the number of scrollable columns has been specified.
      // i.e., the plugin is enabled, then finish initiating it.
      if (numOfScrollableCols > 0) {
        
        // Moves the scrollable columns to the correct position.
        $table.moveColumns(colLocation, true);

        // Updates the buttons to be disabled if necessary.
        $table.updateButtons();
        
        
        // STICKY HEADERS CONT...
        // 
        // Creates the sticky header related stuff, if enabled.
        if (stickyHeadersEnabled) {

          refactorStickyHeaders();
        }
      }
      
      // Attaches the navigation buttons click handler to its wrapper, once it's created.
      // This needs to go in here as there is no gauranteed element available to attach
      // the handler to before this point.
      settings.navButtons.$wrapper.on('click.tableWizardNavButtons',
                                      settings.navButtons._buttons, navButtonsClickHandler);
    
      // Re-initialises the table to be responsive, whenever the window is resized.
      $(window).on('resize.tableWizardWindowResize', tableResizeHandler);
      
    }
    
    
    
    // EVENT HANDLERS
    //
    // Checks which navigation button was clicked, moves the scrollable columns, and disables
    // navigation buttons when necessary.
    var navButtonsClickHandler = function(e) {
      
      // Determines which button has been clicked, previous or next.
      // If the previous button was clicked, decrement the column locations.
      if ($(e.target).is(settings.navButtons.$prev)) {
        
        colLocation--;
        
      // If the next button was clicked, increment the column locations.
      } else if ($(e.target).is(settings.navButtons.$next)) {
        
        colLocation++;
        
      // Otherwise something weird has been clicked, and we should run away!
      // Or, if another button/functionality is implemented. You know. Whatever...
      } else {
        
        return;
        
      }

      // Moves the scrollable columns.
      //moveColumns($scrollableElements, colLocation, animationSpeed, false);
      $table.moveColumns(colLocation);

      // Updates the buttons enabled/disabled states (if necessary).
      //updateButtons(colLocation, totalNumOfCols, numOfScrollableCols);
      $table.updateButtons();

    }
    
    // Refactors the table whenever its width traverses a breakpoint.
    var tableResizeHandler = function() {
      
      // Grabs the new width of the outerWrapper, to decide which defined breakpoint the table currently falls in to.
      outerWrapperWidth = settings.table.$outerWrapper.width();
      
      // If the current number of scrollable columns doesn't equal the new number of scrollable columns,
      // then the tables width has passed a table breakpoint size, and should be refactored to accommodate that.
      // NOTE: This will update the numOfScrollableCols AFTER the if statement has been evaluated...
      //    i.e., the numOfScrollableCols, within the context of the if conditional statement will remain constant
      //          even though, the getNumOfScrollableCols() function alters it.
      //          Bearing that in mind, after the if conditional statement is evaluated, the numOfScrollableCols
      //          will hold the new, updated value.
      if (numOfScrollableCols !== (numOfScrollableCols = getNumOfScrollableCols())) {
        
        // Adjusts the table to have the correct number of scrollable columns.
        $table.refactorTable();
        
        // If the the plugin is re-enabled, then reinstantiate it to its previous column location.
        if (numOfScrollableCols > 0) {
          
          // Moves the scrollable columns to the correct position, in case when the
          // table is refactored, the furthest right column becomes empty.
          $table.moveColumns(colLocation, true);

          // Updates the buttons to be disabled if necessary.
          $table.updateButtons();
          
        }
      }
      
      // If the the plugin is enabled, and stick headers are enabled, then refactor the sticky headers.
      if (numOfScrollableCols > 0 && stickyHeadersEnabled) {
        refactorStickyHeaders();
      }
    }
    
    // Grabs the required values for touch movement at the start of touch.
    var navTouchStartHandler = function(e) {
            
      // Grabs the x position at the start of the touch of the first finger, taking into account its
      // current column location.
      startXPosition = e.originalEvent.touches[0].clientX + (colLocation * $(this).outerWidth());

      // Sets a movement value on start, so if the screen is just tapped, after the buttons have
      // been used for navigation, then the xMovementAsADecimal won't have been updated, as
      // the touchmove event won't of ever fired.
      xMovementAsADecimal = -colLocation;

    }
    
    // Animates the movement of the scrollable columns as they're swiped around.
    var navTouchMoveHandler = function(e) {

      // Grabs the x touch co-ordinate of the first finger as it moves.
      var currentXPosition = e.originalEvent.touches[0].clientX;

      // Calculates the distance and direction the first finger has moved across the screen.
      var xMovement = (currentXPosition - startXPosition);

      // Convers the distance and direction of the first fingers movement into a decimal, and
      // then into a percentage.
      xMovementAsADecimal = xMovement / $(this).outerWidth();
      var xMovementAsAPercentage = xMovementAsADecimal * 100;

      // Moves the columns.
      TweenMax.set($scrollableElements, {
        xPercent: function() { return xMovementAsAPercentage; },
      });

    }
    
    // Finishes the touch movement by setting the necessary values, and ensuring that
    // the correct column is set.
    var navTouchEndHandler = function(e) {
            
      // Sets the colLocation to have the rounded x position present at the end of the touch.
      colLocation = -(Math.round(xMovementAsADecimal));

      // If the colLocation is less than 0, snap to the first column.
      if (colLocation < 0) {
        colLocation = 0;
      }

      // Moves the columns.
      $table.moveColumns(colLocation, false);

      // Updates the buttons.
      $table.updateButtons();

    }
    
    
    
    // Resizes and Reposition the sticky header wrapper.
    var refactorStickyHeaders = function() {
      
      // Grabs the width PERCENTAGE that the sticky wrapper should be.
      var curWidthPercentage = (numOfScrollableCols * widthOfColAsPercentage + '%');
      
      // Grabs the width VALUE that the sticky wrapper should be.
      var curWidthValue = settings.navButtons.$wrapper.width();
      
      // Calculates what the 'right' value should be when the sticky wrapper is fixed.
      var globalRightValue = Math.round(
        $(window).width() -
          (
            settings.navButtons.$wrapper.offset().left
            + curWidthValue
          )
        ) + 'px';
      
      // Adds functionality to the event listeners of the sticky wrapper.
      // The stick and unbottom events adjust the right value relative to the viewport.
      //   (basically, when the sticky wrapper is a fixed positioned element)
      // The unstick and bottom events adjust the right value relative to its parent.
      //   (basically, when the sticky wrapper is an absolutely positioned element)
      settings.stickyKit.$wrapper
        .off('sticky_kit:stick').on('sticky_kit:stick', function(e) {
          settings.stickyKit.$wrapper.css({
            'right': globalRightValue,
            'width': curWidthValue,
          });
        })
        .off('sticky_kit:unstick').on('sticky_kit:unstick', function(e) {
          settings.stickyKit.$wrapper.css({
            'position': 'absolute',
            'right': '0',
            'width': curWidthPercentage,
          });
        })
        .off('sticky_kit:bottom').on('sticky_kit:bottom', function(e) {
          settings.stickyKit.$wrapper.css({
            'position': 'absolute',
            'right': '0',
            'width': curWidthPercentage,
          });
        })
        .off('sticky_kit:unbottom').on('sticky_kit:unbottom', function(e) {
          settings.stickyKit.$wrapper.css({
            'right': globalRightValue,
            'width': curWidthValue,
          });
        });
      
      // Updates the all sticky_kit items cached values.
      // This basically fixes erroneous jumps and mis-positions.
      $(document.body).trigger('sticky_kit:recalc');
    }
    
    
    
    // INITIALISE THE PLUGIN
    //
    // Run the init function, which sets everything up correctly.
    init();
    
    
    
    // Return this object for chaining.
    return this;

  };
  
  // Plugin defaults – added as a property on the plugin function.
  // These are GLOBAL, across all applications of the tableWizard plugin.
  $.fn.tableWizard.defaults = {
    
    table: {

      // The name of the outer wrapper.
      //    If it doesn't exist, it will be created.
      outerWrapper: 'outer-table-wrapper',

      // The name of the table wrapper.
      overflowWrapper: 'overflow-fix-wrapper',
      
      // The 0-based column index of the first scrollable column.
      // As there might be multiple static columns on the left-hand side of the table.
      scrollableColFirstIndex: 0,
      
      // The ~total~ number of scrollable columns.
      // As there might be static columns to the right-hand of the table.
      totalNumberOfScrollableCols: 0,
      
      // The number of scrollable columns to have at various breakpoints.
      // If this is equal to 0, then the plugin is disabled.
      // Otherwise, this should be an object literal (an associative array), where the key is
      // an integer, which is the maximum-width the tables outerWrapper should be, in pixels, whilst possessing
      // a given number of scrollable columns, represented by the value.
      // Once the width of the table exceeds the largest given key, the plugin is effectively disabled.
      // e.g.,
      //        360: 1, 568: 2, 800: 3
      //     Would give:
      //        1 scrollable column when the table <= 360px wide.
      //        2 scrollable columns when the table is between > 360px wide, and <= 568px wide.
      //        3 scrollable columns when the table is between < 568px wide, and <= 800px wide.
      //        Disable the scrollable columns altogether at > 800px wide, effectively disabling the plugin.
      //
      // NOTE: It's important to note that the breakpoints are relative to the TABLE width, not the
      //       screen!
      //       This could have a switch, and go on the TODO list, but it's not urgent enough to warrant action
      //       at the moment.
      numOfScrollableCols: 0,
    },

    navButtons: {

      // The class names for the buttons
      wrapper: 'column-navigation-button-wrapper',
      buttons: 'column-navigation-button',
      prev: 'column-navigation-button_prev',
      next: 'column-navigation-button_next',

      // The HTML that's to go inside of the buttons.
      prevHTML: '<<',
      nextHTML: '>>',
    },

    animation: {

      // The speed at which the column scroll animation should play at.
      speed: 0.3,
    },
    
    stickyKit: false,           // Don't use the stickyKit plugin.
    
    touchMove: false,           // Don't use the touchMove functionality.
    
  };

// End Closure.
}(jQuery));
