function onscrollUpdateStacks(stackElems, links, lines) {
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

  var didUpdate = false;

  for (i = 0; i < stackElems.length; ++i) {
    // Update the elements that don't have the correct state already.
    var shouldBeOpaque = (current == -1) || (current == i);
    if (stackElems[i][2] == shouldBeOpaque) continue;

    stackElems[i][2] = shouldBeOpaque;

    if (shouldBeOpaque) {
      didUpdate = true;
      stackElems[i][0].classList.add("tk-stack-active");
    } else {
      didUpdate = true;
      stackElems[i][0].classList.remove("tk-stack-active");
    }
  }

  if (didUpdate) {
    for (var i = 0; i < links.length; ++i) {
      links[i].classList.remove("is-active");
    }

    links[current+1].classList.add("is-active");

    if (current != -1 && stackElems[current][0].dataset.stackId == "tracing") {
      lines.classList.add("tk-stack-active");
    } else {
      lines.classList.remove("tk-stack-active");
    }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var stack = document.getElementsByClassName("tk-stack-active");
  var links = document.querySelectorAll(".tk-stack .menu li");
  var lines = document.getElementById("tk-stack-lines");

  // Done in JS so that when JS is not enabled, no links are enabled.
  links[0].classList.add("is-active");

  var stackElems = [];
  for (var i = 0; i < stack.length; ++i) {
    var stackId = stack[i].dataset.stackId;
    var div = document.getElementById("tk-lib-stack-" + stackId);
    // The boolean stores whether it is currently opaque.
    stackElems.push([stack[i], div, true]);
  }

  if (stackElems.length > 0) {
    var fn = function() {
      onscrollUpdateStacks(stackElems, links, lines);
    };
    window.addEventListener("scroll", fn);
    window.addEventListener("resize", fn);
    setTimeout(fn);
  }
});