// Job title keywords for entry-level IT / QA roles, sourced from
// "IT_Entry_Level_and_Lithuania_Tech_Market_Titles.pdf" (research date 15 Sep 2026).
// Multi-word phrases are matched as substrings; SHORT_CODES are matched with
// strict word boundaries only, since bare "IT" or "QA" alone would be too noisy.

const PHRASES = [
  // General IT / entry
  'IT Intern',
  'IT Trainee',
  'IT Assistant',
  'IT Support Technician',
  'IT Support Specialist',
  'IT Support',
  'Junior IT Specialist',
  'Junior Onsite IT Support Specialist',
  'IT Customer Support Specialist',

  // Help desk / service desk
  'Help Desk Technician',
  'Help Desk',
  'Service Desk Agent',
  'Service Desk Analyst',
  'Service Desk',

  // L1 / L2 support
  'L1 Support Engineer',
  'L2 Support Engineer',
  'L1 Support',
  'L2 Support',
  'Support Engineer',

  // Technical / product / application support
  'Technical Support Specialist',
  'Technical Support Engineer',
  'Technical Support',
  'Product Support Specialist',
  'Product Support',
  'Application Support Analyst',
  'Application Support',
  'Support Analyst',

  // Desktop / field / onsite
  'Desktop Support Technician',
  'Desktop Support',
  'Field Support Technician',
  'Field Service',
  'Hardware Support',

  // Operations / NOC / monitoring
  'IT Monitoring Technician',
  'NOC Technician',
  'IT Operations',

  // Systems / infrastructure
  'Junior System Administrator',
  'System Administrator',
  'Systems Administrator',
  'Junior Systems Administrator',
  'Junior Infrastructure Technician',
  'Infrastructure Engineer',
  'Infrastructure Support',
  'Computer Systems Administrator',

  // Networking
  'Junior Network Technician',
  'Network Administrator',
  'Network Technician',
  'Network Support',
  'Network Analyst',
  'Computer Network Technician',
  'Computer Network Administrator',
  'Junior Network',

  // QA / testing
  'QA Intern',
  'Test Intern',
  'QA Tester',
  'Software Tester',
  'Manual QA Tester',
  'Manual QA',
  'Junior QA Engineer',
  'QA Engineer',
  'QA Specialist',
  'Test Analyst',
  'Systems Tester',
  'ICT Test Analyst',

  // Electronics-adjacent
  'Electronic Equipment Technician',

  // Lithuanian market wording
  'IT pagalbos specialistas',
  'IT palaikymo specialistas',
  'IT technikas',
  'IT pagalbos technikas',
  'Pagalbos tarnybos specialistas',
  'IT aptarnavimo specialistas',
  'IT klientų aptarnavimo specialistas',
  'L1 palaikymo inžinierius',
  'pirmosios linijos palaikymo inžinierius',
  'Techninio palaikymo specialistas',
  'Jaunesnysis IT specialistas',
  'Jaunesnysis IT pagalbos specialistas',
  'Programų palaikymo specialistas',
  'taikomųjų programų palaikymo specialistas',
  'IT operacijų technikas',
  'sistemų stebėsenos technikas',
  'NOC technikas',
  'NOC specialistas',
  'Kompiuterių tinklų ir sistemų technikas',
  'Tinklų administratorius',
  'Kompiuterių sistemų administratorius',
  'Kompiuterių ryšių analitikas',
  'Tinklo analitikas',
  'Kompiuterių tinklo administratorius',
  'QA testuotojas',
  'programinės įrangos testuotojas',
  'Rankinio testavimo specialistas',
  'sistemų testuotojas',
  'QA inžinierius',
  'testavimo inžinierius',
  'testavimo analitikas',
  'Jaunesnysis sistemų administratorius'
];

// Short, unambiguous codes - matched with strict word boundaries in code.
const SHORT_CODES = ['QA', 'L1', 'L2', 'NOC', 'SOC'];

module.exports = { PHRASES, SHORT_CODES };
