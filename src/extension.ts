import * as vscode from 'vscode';
import { moveViewport, moveCursor, alignViewport, calculateRanges } from "./utils";
import { ScrollDirection, ScrollDistance, Scroller, SCROLLERS } from "./types";

let scrollOff = vscode.workspace.getConfiguration('editor').get('cursorSurroundingLines') as number;

const scroll = (direction: ScrollDirection, distance: ScrollDistance) => {
   const editor = vscode.window.activeTextEditor!;
   if (!editor) return;

   const { visibleRanges } = editor,
      firstSegmentRangeStart = visibleRanges[0].start.line,
      firstSegmentRangeEnd = visibleRanges[0].end.line,
      lastSegmentRangeStart = visibleRanges[visibleRanges.length - 1].start.line,
      lastSegmentRangeEnd = visibleRanges[visibleRanges.length - 1].end.line,
      allSegmentsRanges = calculateRanges(direction),
      allSegmentsRangeValue = allSegmentsRanges.end - allSegmentsRanges.start,

      cursorPosition = editor.selection.active.line,
      firstSegmentDistanceStart = cursorPosition - firstSegmentRangeStart,
      firstSegmentDistanceEnd = firstSegmentRangeEnd - cursorPosition,
      lastSegmentDistanceStart = cursorPosition - lastSegmentRangeStart,
      lastSegmentDistanceEnd = lastSegmentRangeEnd - cursorPosition,

      hasNumberDistance = distance !== 'halfPage' && distance !== 'page',
      hasFolds = firstSegmentDistanceStart < 0 || firstSegmentDistanceEnd < 0 || (firstSegmentDistanceEnd <= scrollOff && allSegmentsRanges.end !== firstSegmentRangeEnd),
      hasScrollOffContact = (hasNumberDistance && (direction === 'down' && scrollOff >= firstSegmentDistanceStart))
         || (hasNumberDistance && (direction === 'up' && scrollOff + 1 >= lastSegmentDistanceEnd));

   let distanceValue = distance === 'halfPage' ? Math.floor(allSegmentsRangeValue / 2) : distance === 'page' ? allSegmentsRangeValue : distance;

   // Logs
   (() => { // iife to add folding ability
      console.log('{ == #log start ==>');
      console.log('#numberOfSegments', visibleRanges.length);
      console.log('------------------------------------------');
      console.log('#first: rangeStart:', firstSegmentRangeStart, '| rangeEnd', firstSegmentRangeEnd);
      console.log('#first: distStart:', firstSegmentDistanceStart, '| distEnd', firstSegmentDistanceEnd);
      console.log('------------------------------------------');
      console.log('#last rangeStart:', lastSegmentRangeStart, '| rangeEnd', lastSegmentRangeEnd);
      console.log('#last: distStart:', lastSegmentDistanceStart, '| distEnd', lastSegmentDistanceEnd);
      console.log('------------------------------------------');
      console.log('#all rangeStart:', allSegmentsRanges.start, '| rangeEnd:', allSegmentsRanges.end);
      console.log('#all rangeVal:', allSegmentsRangeValue);
      console.log('------------------------------------------');
      console.log('cursorPos:', cursorPosition);
      /*       for (let i = 0; i < visibleRanges.length; i++) {
               console.log(`#SEGMENT${i} rangeStart:`, visibleRanges[i].start.line, '| rangeEnd', visibleRanges[i].end.line);
               console.log(`#SEGMENT${i} distStart:`, cursorPosition - visibleRanges[i].start.line, '| distEnd', visibleRanges[i].start.line - cursorPosition);
               console.log('------------------------------------------');
            } */
      console.log('<== #log end }');
   })();
   if (distance === 0) return; // do not scroll when using printPos command

   // Fix cursor moves to end of line when scrolling beyond last line
   if (hasNumberDistance && direction === 'down' && allSegmentsRangeValue <= scrollOff + distance) {
      console.log('#fix');
      moveViewport(direction, allSegmentsRangeValue - scrollOff);
      moveCursor(direction, allSegmentsRangeValue - scrollOff);
      // vscode.commands.executeCommand('cursorMove', { to: 'viewPortBottom', by: 'wrappedLine' });
   }
   // Keep cursor moving when top boundary is reached
   else if (firstSegmentRangeStart === 0 && direction === 'up') {
      console.log('#moveCurosor');
      moveViewport(direction, distanceValue);
      moveCursor(direction, distanceValue);
   }
   // Scroll from top boundary 
   else if (hasNumberDistance && firstSegmentRangeStart === 0 && direction === 'down') {
      console.log('#fromTop');
      moveViewport(direction, distance + scrollOff);
      alignViewport('up');
   }
   // Scroll when lines to top boundary remain
   else if (firstSegmentRangeStart > 0 && firstSegmentRangeStart <= scrollOff && direction === 'up') {
      console.log('#remainingLines');
      moveViewport(direction, allSegmentsRanges.start);
      moveCursor(direction, allSegmentsRanges.start);
   }
   // Scroll when visibleRange is mutated through folds
   else if (hasNumberDistance && (hasFolds)) {
      const hasFoldBelow = lastSegmentDistanceStart <= scrollOff,
         hasFoldAbove = firstSegmentDistanceEnd <= scrollOff;

      distanceValue = direction === 'down' && hasFoldBelow
         ? distance + scrollOff + 1
         : direction === 'up' && hasFoldAbove
            ? distance + scrollOff + 1
            : distance;

      console.log('#mutaed | distanceValue: ', distanceValue);
      moveViewport(direction, distanceValue);
      alignViewport();
   }
   // Scroll when cursor is touching scrollOff
   else if (hasScrollOffContact) {
      console.log('#touchingScrolloff');
      moveViewport(direction, distance);
      moveCursor(direction, distance < scrollOff ? distance : scrollOff);
   }
   // Scroll when using string distance values
   else if (!hasNumberDistance) {
      console.log('#stringDistance');
      vscode.commands.executeCommand('editorScroll', { to: direction, by: distance, revealCursor: true });
      alignViewport();
   }
   // Scroll default
   else {
      console.log('#default');
      moveViewport(direction, distance);
   }
};

const getConfig = (scroller: string) => vscode.workspace.getConfiguration("germanScroll").get(scroller) as ScrollDistance;

export function activate(context: vscode.ExtensionContext) {
   SCROLLERS.forEach((scroller: Scroller) => {
      let config = getConfig(scroller);

      vscode.workspace.onDidChangeConfiguration(async event => {
         if (event.affectsConfiguration("germanScroll")) config = getConfig(scroller);
         if (event.affectsConfiguration("editor.cursorSurroundingLines")) scrollOff = vscode.workspace.getConfiguration('editor').get('cursorSurroundingLines') as number;
      });

      context.subscriptions.push(
         vscode.commands.registerCommand(`germanScroll.${scroller}Down`, () => scroll("down", config)),
         vscode.commands.registerCommand(`germanScroll.${scroller}Up`, () => scroll("up", config)),
      );
   });
   vscode.commands.registerCommand(`germanScroll.printPos`, () => scroll('down', 0));
}

export function deactivate() { }
