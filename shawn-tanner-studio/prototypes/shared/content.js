/*
 * Shared business content for all three prototypes.
 * Every prototype reads the same facts so the comparison is fair.
 * Edit wording here once and all three designs update.
 *
 * Placeholders are labelled honestly: services are proposed (not confirmed),
 * testimonials are reserved (not real quotes). No ages, career dates or
 * credentials appear anywhere.
 */
(function () {
  'use strict';

  var services = [
    {
      id: 'bookkeeping', icon: '≋', name: 'Bookkeeping & clarity',
      short: 'Bring order to the day-to-day, and know where your business stands.',
      description: 'Explore support for organizing transactions, reconciling records and building a consistent bookkeeping routine.',
      benefit: 'A clearer view of the numbers, with less time spent untangling them.',
      prepare: 'Recent bookkeeping reports and a description of your current process.'
    },
    {
      id: 'strategy', icon: '↗', name: 'Strategic accounting',
      short: 'Turn your numbers into a more useful plan for what comes next.',
      description: 'Discuss management reporting, budgeting and how accounting can support the decisions you face as an owner.',
      benefit: 'Better context for decisions about spending, priorities and growth.',
      prepare: 'Your biggest business decision and any existing budget or reports.'
    },
    {
      id: 'tax', icon: '▤', name: 'Tax consulting',
      short: 'Get organized, ask better questions and approach tax planning with clarity.',
      description: 'Start a conversation about tax-related questions, record readiness and coordination with your tax preparer. The right scope is agreed together.',
      benefit: 'A more organized starting point for tax conversations and planning.',
      prepare: 'Your questions and a general overview of how your taxes are handled.'
    },
    {
      id: 'cashflow', icon: '◷', name: 'Cash-flow planning',
      short: 'Understand the rhythm of money coming in and going out.',
      description: 'Explore a practical cash-flow forecast, timing of collections and payments, and visibility into upcoming commitments.',
      benefit: 'An earlier view of potential cash gaps and a clearer planning conversation.',
      prepare: 'A summary of recurring costs, incoming payments and seasonal patterns.'
    },
    {
      id: 'reporting', icon: '▥', name: 'Financial reporting',
      short: 'Make the big picture easier to understand and act on.',
      description: 'Discuss useful financial reports, a regular review cadence and which numbers matter for your business.',
      benefit: 'Reports that support conversations and decisions, rather than sit unread.',
      prepare: 'Any current financial reports and the questions they leave unanswered.'
    }
  ];

  var guide = {
    needs: [
      { id: 'bookkeeping', label: 'My records need organizing' },
      { id: 'cashflow', label: 'Cash flow feels unpredictable' },
      { id: 'tax', label: 'I have tax-related questions' },
      { id: 'strategy', label: 'I’m planning my next move' },
      { id: 'reporting', label: 'My reports don’t tell me enough' }
    ],
    stages: [
      { id: 'starting', label: 'Getting started' },
      { id: 'established', label: 'Established and busy' },
      { id: 'growing', label: 'Growing or changing' },
      { id: 'unsure', label: 'Still figuring things out' }
    ],
    stageNotes: {
      starting: 'Start with a simple recordkeeping routine and a clear view of the costs of getting established.',
      established: 'Focus the conversation on your current workflow and what is taking too much of your time.',
      growing: 'Bring the decision or change you are planning, along with the numbers you currently use to evaluate it.',
      unsure: 'You do not need a polished plan. Begin with the part of your business that feels least clear.'
    },
    disclaimer: 'A conversation guide, not individualized financial or tax advice.'
  };

  /* Sample availability: weekday and time only, never real dates, so nothing looks reserved. */
  var sampleTimes = [
    { id: 'tue-am', label: 'Tuesday · 10:00 AM' },
    { id: 'tue-pm', label: 'Tuesday · 2:00 PM' },
    { id: 'wed-am', label: 'Wednesday · 11:00 AM' },
    { id: 'thu-am', label: 'Thursday · 9:30 AM' },
    { id: 'thu-pm', label: 'Thursday · 3:00 PM' },
    { id: 'fri-pm', label: 'Friday · 1:00 PM' }
  ];

  window.ShawnContent = {
    businessName: 'Shawn Tanner',
    businessNameNote: 'Working name. The official business name is not confirmed yet.',
    tagline: 'Small Business Accounting',
    locations: ['Jacksonville', 'St. Augustine', 'Fernandina Beach'],
    regionLine: 'Northeast Florida',
    introduction: 'You’ve got a business to run. Shawn Tanner brings corporate accounting experience and a modern, personal approach to helping you make sense of the numbers.',
    trustPoints: ['Corporate accounting experience', 'A modern approach', 'A person you can talk to'],
    services: services,
    servicesNote: 'Prototype service menu — final offerings to be confirmed with Shawn.',
    testimonials: [
      { id: 'one', quote: 'Your first client’s story belongs here.', note: 'Reserved for your supplied testimonial · not a client quote' },
      { id: 'two', quote: 'Your second client’s perspective belongs here.', note: 'Reserved for your supplied testimonial · not a client quote' }
    ],
    guide: guide,
    sampleTimes: sampleTimes,
    demoNotice: 'Prototype only: no appointment is booked, no information is transmitted or saved, and no marketing subscription is created.',
    privacyParagraphs: [
      'This prototype has no visitor tracking or connected lead database. Form information stays in this page’s memory and is cleared when you close the form or reload.',
      'The intended live experience requests one preferred contact method; the other is optional. Inquiry follow-up and marketing subscriptions will be separate choices.',
      'Please do not enter tax IDs, passwords, bank details or upload financial documents here.'
    ]
  };

  /* Small helpers shared by every prototype. */
  window.ShawnUtil = {
    escapeHtml: function (value) {
      return String(value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    findService: function (id) {
      return services.filter(function (s) { return s.id === id; })[0] || null;
    },
    /* Guide result logic: depends on both selections. */
    guideResult: function (needId, stageId) {
      var service = window.ShawnUtil.findService(needId);
      if (!service || !guide.stageNotes[stageId]) return null;
      return { service: service, stageNote: guide.stageNotes[stageId] };
    }
  };
})();
