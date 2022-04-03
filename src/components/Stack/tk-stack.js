import clsx from 'clsx';
import styles from './styles.module.scss';


export default function onscrollUpdateStacks(stackElems, links, lines) {
  var i;
  var stackBox = stackElems[0][0].getBoundingClientRect();
  var stackMid = (stackBox.top + 3 * stackBox.bottom) / 4.0;

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
      stackElems[i][0].classList.add(styles.tkStackActive);
    } else {
      didUpdate = true;
      stackElems[i][0].classList.remove(styles.tkStackActive);
    }
  }

  if (didUpdate) {
    for (var i = 0; i < links.length; ++i) {
      links[i].classList.remove(styles.isActive);
    }

    links[current + 1].classList.add(styles.isActive);

    if (current != -1 && stackElems[current][0].dataset.stackId == "tracing") {
      lines.classList.add(styles.tkStackActive);
    } else {
      lines.classList.remove(styles.tkStackActive);
    }
  }
}

