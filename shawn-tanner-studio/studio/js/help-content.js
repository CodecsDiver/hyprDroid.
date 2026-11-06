// Words for the information cards and the guided walkthrough.
// The tour is written from Dan to his dad: warm, direct, plain words.

export const INFO_CARDS = {
  design: {
    title: 'Choose a design',
    body: 'These buttons switch between the three versions of your website. They show the same business in different ways.'
  },
  page: {
    title: 'Choose a page',
    body: 'Open the home page, the services page or the starting-point guide. Links inside the website work too.'
  },
  mode: {
    title: 'Browse or leave feedback',
    body: 'Browse the website lets you use it normally. Leave feedback lets you point at a part of the page to tell Dan what you think. Nothing on the sample websites sends a message or books a real appointment.'
  },
  compare: {
    title: 'Compare two designs',
    body: 'Pick exactly two different designs to see them next to each other. On a phone you switch between them with two tabs.'
  },
  together: {
    title: 'Keep pages together',
    body: 'When this is on, opening a page in one design opens the same page in the other. Turn it off to explore each one on its own.'
  },
  panel: {
    title: 'The review panel',
    body: 'This is where your choices and notes live. Open it to see the part you selected, your favorites, the summary and the download buttons. Collapse it any time to see the whole website.'
  },
  choices: {
    title: 'Keep, Change or Remove',
    body: 'Keep means you like it. Change means you would like it different (a short note helps). Remove means it should go. These are only your preferences. The sample website itself never changes.'
  },
  favorite: {
    title: 'Favorites',
    body: 'Star the parts you would like to use in the real website, even if they come from different designs. If you star two choices for the same job, both are kept and marked for a conversation.'
  },
  windows: {
    title: 'Pop-up windows',
    body: 'The welcome window, the consultation form and the privacy note appear on top of the page. Use this menu to open them so you can leave feedback on them.'
  },
  summary: {
    title: 'Summary',
    body: 'Every choice and note in one list, plus the things that still need a decision and the parts you have not looked at yet.'
  },
  save: {
    title: 'Saving and sending',
    body: 'Your notes are saved in this browser as you go. Download the report to read, or the notes file to send to Dan. He can load that file back into the studio. Sharing the studio link does not share your notes.'
  },
  excluded: {
    title: 'What can’t be selected',
    body: 'The grey “design preview” banner, the × buttons on pop-up windows and the dimmed area behind a pop-up are left out on purpose. Everything else on the page can be selected.'
  }
};

export const TOUR_STEPS = [
  {
    id: 'welcome', title: 'Welcome, Dad.', target: '.brand-block',
    body: 'Dad, I made this so we can figure out what feels right for your business. These are working samples. Try them, tell me what you like, and we’ll use your choices to shape the real website.',
    nextLabel: 'Show me around'
  },
  {
    id: 'design', title: 'Try a different look.', target: '#design-group',
    body: 'These buttons switch between three versions of your website. They’re different ways of presenting the same business.',
    actionLabel: 'Switch to another version', action: 'nextDesign'
  },
  {
    id: 'pages', title: 'Look through the pages.', target: '#page-group',
    body: 'Use this menu to open the home page, services or the starting-point guide. You can also follow the links inside the website.',
    actionLabel: 'Open the next page', action: 'nextPage'
  },
  {
    id: 'browse', title: 'Try it like a client.', target: '#mode-group',
    body: 'Browse mode lets you use the website normally. Try the buttons and forms. Nothing here sends a message or books a real appointment.',
    actionLabel: 'Turn on browse mode', action: 'browseMode'
  },
  {
    id: 'point', title: 'Point to what you mean.', target: '#mode-group',
    body: 'Turn on feedback mode, then click something you want me to look at. I’ll know which part you mean.',
    actionLabel: 'Turn on feedback mode', action: 'feedbackMode',
    doneNote: 'Nice. The review panel now shows the part you picked.'
  },
  {
    id: 'preference', title: 'Tell me your preference.', target: '#review-panel',
    body: 'Choose Keep, Change or Remove. Add a note if you want something different. You can come back and change your mind.',
    practice: true
  },
  {
    id: 'compare', title: 'Compare two versions.', target: '#compare-group',
    body: 'Pick two designs to view together. You can keep their pages together or explore each one separately.',
    actionLabel: 'Open the comparison choices', action: 'openCompare'
  },
  {
    id: 'favorites', title: 'Mix your favorites.', target: '[data-tab="favorites"]',
    body: 'You can like the home page in one version and the service cards in another. Save both preferences; we’ll work out how they fit together.',
    actionLabel: 'View favorites', action: 'tabFavorites'
  },
  {
    id: 'summary', title: 'Review your notes.', target: '[data-tab="summary"]',
    body: 'This is your list of choices. Check it whenever you want, and change anything that no longer feels right.',
    actionLabel: 'Open the summary', action: 'tabSummary'
  },
  {
    id: 'send', title: 'Send me your choices.', target: '#download-buttons',
    body: 'Download your notes and send me the file. I can use it to see exactly what you picked and why.',
    actionLabel: 'Show the download buttons', action: 'tabSave'
  },
  {
    id: 'return', title: 'Come back anytime.', target: '#help-button',
    body: 'That’s everything, Dad. Your notes stay in this browser when saving is available. Download a backup before changing devices or clearing browser data. The Help button will show you around again whenever you want.',
    nextLabel: 'Finish'
  }
];
