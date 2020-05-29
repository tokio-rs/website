var didRunOnce = false;

function onscrollUpdateStacks(stackElems, lines) {
  var i;
  var stackBox = stackElems[0][0].getBoundingClientRect();
  var stackMid = (stackBox.top + 3*stackBox.bottom) / 4.0;

  var current = -1;
  var currentY = -Infinity;
  // Find the thing to highlight.
  for (i = 0; i < stackElems.length; ++i) {
    var divBox = stackElems[i][1].getBoundingClientRect();
    // We want to highlight it if the div is sufficiently far down compared
    // to the floating stack image.
    if (divBox.top < stackMid) {
      // And among those, we want the top one.
      if (currentY < divBox.top) {
        current = i;
        currentY = divBox.top;
      }
    }
  }

  for (i = 0; i < stackElems.length; ++i) {
    var stackId = stackElems[i][0].dataset.stackId;

    // Update the elements that don't have the correct state already.
    var shouldBeOpaque = (current == -1) || (current == i);
    if (stackElems[i][2] == shouldBeOpaque) continue;

    stackElems[i][2] = shouldBeOpaque;

    if (shouldBeOpaque) {
      stackElems[i][0].classList.add("tk-stack-active");

      if (stackId == "tracing") {
        lines.classList.add("tk-stack-active");
      }
    } else {
      stackElems[i][0].classList.remove("tk-stack-active");

      if (stackId == "tracing") {
        lines.classList.remove("tk-stack-active");
      }
    }
  }

  if (!didRunOnce) {
    didRunOnce = true;

    if (current != -1 && stackElems[current][0].dataset.stackId == "tracing") {
      lines.classList.add("tk-stack-active");
    }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var stack = document.getElementsByClassName("tk-stack-active");
  var lines = document.getElementById("tk-stack-lines");

  var stackElems = [];
  for (var i = 0; i < stack.length; ++i) {
    var stackId = stack[i].dataset.stackId;
    var div = document.getElementById("tk-lib-stack-" + stackId);
    // The boolean stores whether it is currently opaque.
    stackElems.push([stack[i], div, true]);
  }

  if (stackElems.length > 0) {
    var fn = function() {
      onscrollUpdateStacks(stackElems, lines);
    };
    window.addEventListener("scroll", fn);
    window.addEventListener("resize", fn);
    setTimeout(fn);
  }

  // setTimeout(function() {
  //   var hero = document.getElementById("tk-hero-bg");
  //   var dimensions = hero.getBoundingClientRect();
  
  //   let width = dimensions.width
  //   let height = dimensions.height;
  
  //   console.log("DIMENSIONS", hero, width, height);
  
  //   let newHeight;
  //   let newWidth;
  
  //   function genNewWidth() {
  //     newWidth = Math.floor(Math.random() * width);
  //   }
  //   function genNewHeight() {
  //     newHeight = Math.floor(Math.random() * height );
  //   }
  
  //   function setPos(ele) {
  //     ele.style.top = newHeight + 'px';
  //     ele.style.left = newWidth + 'px';
  //   }
  
  //   function moveObj(arr) {
  //     for(let i = 0; i < arr.length; i++) {
  //       genNewWidth();
  //       genNewHeight();
  //       setPos(arr[i]);
  //     }
  //   }
  //   function moveObjRandomly(arr) {
  //     for(let i = 0; i < Math.floor(Math.random() * arr.length); i++) {
  //       genNewWidth();
  //       genNewHeight();
  //       setPos(arr[i]);
  //     }
  //   }
  
  //   let arrs = document.querySelectorAll('.tk-float');
  
  //   function moveArrs() {
  //     moveObj(arrs);
  //   }
  //   function moveArrsRandomly() {
  //     moveObjRandomly(arrs);
  //   }
  //   moveObj(arrs);
  //   setTimeout(moveArrs, 1000);
  //   setInterval(moveArrsRandomly, 5000);
  // });
});