import { ExperimentDilemma, StoryLogEntry, VaultDefinition } from '../types/game';

export const ATRIUM_INCIDENT_LOGS: StoryLogEntry[] = [
  {
    id: 'log-cam-04',
    code: 'CAM-04 // ATRIUM CORRIDOR',
    title: 'Security Camera Recording #04',
    timestamp: '2024-12-14 · 23:47:19',
    source: 'West Wing Optical Sensor',
    classification: 'SECURITY CAM',
    body: [
      'Frame analysis confirms zero physical personnel entered the main research floor after 22:15.',
      'At 23:47:19, Workstation B-07 illuminated autonomously. Remote session token "EXT-SYNC-09" initiated a high-priority query against the Bioactivity Archive.',
      'Seconds later, power draw on Server Rack C spiked to 142% rated load before the cooling interlock tripped.',
    ],
    nexusNote:
      'No intruder walked through the doors. The breach originated from an unauthorized remote pipeline job.',
  },
  {
    id: 'log-server-err',
    code: 'SYS-DUMP // PIPELINE-409',
    title: 'Corrupted Batch Export Record',
    timestamp: '2024-12-14 · 23:48:04',
    source: 'Automated Screening Queue',
    classification: 'CORRUPTED FILE',
    body: [
      'JOB_ID: EXPORT_BQ409_FASTTRACK [STATUS: ABORTED BY SAFEGUARD]',
      'WARNING: Incoming SMILES parser encountered malformed syntax strings in batch rows 14–19.',
      'ALERT: External script attempted to overwrite Lipinski descriptor flags and publish an unverified XGBoost prediction directly to the client portal.',
    ],
    nexusNote:
      'Someone tried to push a flawed compound report past our validation vaults. Recover all five keys to inspect the full audit trail.',
  },
  {
    id: 'log-dr-vance',
    code: 'LAB-NOTE // DR. E. VANCE',
    title: 'Lead Scientist Shift Memo',
    timestamp: '2024-12-14 · 21:30:00',
    source: 'Principal Investigator Terminal',
    classification: 'RESEARCH LOG',
    body: [
      'Note to morning shift: Do NOT release compound BQ-409 from the screening archive. Its measured IC50 was never reproduced in a comparable assay, and its molecular weight exceeds oral drug-likeness guidelines.',
      'I have enabled NEXUS Integrity Safeguard Level 5 across all five research vaults until the audit finishes.',
      'Candidate BQ-714 remains our legitimate lead for further wet-lab validation only—never let marketing describe a model score as a proven drug.',
    ],
    nexusNote:
      'Dr. Vance locked down the protocol before leaving. Investigating all five vaults will let us restore the facility safely.',
  },
];

export const VAULTS: VaultDefinition[] = [
  // =========================================================================
  // VAULT 01 — THE BIOACTIVITY ARCHIVE (Easy)
  // =========================================================================
  {
    id: 1,
    code: 'VAULT 01',
    title: 'The Bioactivity Archive',
    wing: 'South-West Wing',
    difficulty: 'Easy',
    keyName: 'Research Key 01',
    accentHex: '#06b6d4',
    worldPosition: { x: -10.5, z: 5.5 },
    mapPosition: { x: 20, y: 74 },
    nexusIntro:
      'Welcome to Vault 01, the Bioactivity Archive. Before the blackout, an automated script tampered with our IC50 assay records. Review the core concepts of molecules, biological targets, and bioactivity, then verify the archive records to recover Research Key 01.',
    nexusCompletion:
      'Archive integrity verified. Research Key 01 acquired. Vault 02, the SMILES Laboratory, is now unlocked.',
    storyLog: {
      id: 'vault-01-log',
      code: 'ARCHIVE-AUDIT-01',
      title: 'Suspicious Assay Override Detected',
      timestamp: '2024-12-14 · 23:47:31',
      source: 'Bioactivity Archive Server',
      classification: 'INCIDENT RECORD',
      body: [
        'An automated process queried COX-2 and EGFR assay tables simultaneously and attempted to reclassify compound BQ-409 (IC50 = 4,500 nM) as "Active".',
        'Archive checksum rejected the manual override, causing the script to reroute into Vault 02 (SMILES Laboratory).',
      ],
      nexusNote:
        'A higher IC50 means weaker potency—someone tried to disguise an inactive entry as potent. Let us follow the trail into Vault 02.',
    },
    concepts: [
      {
        term: 'Molecules',
        explanation:
          'Molecules are groups of two or more atoms bonded together that form the building blocks of medicines and biological compounds.',
        examples: [
          'Water (H2O) is a small molecule made of two hydrogen atoms bonded to one oxygen atom.',
          'Aspirin (acetylsalicylic acid) is a small organic molecule designed to interact with proteins in the body.',
        ],
      },
      {
        term: 'Biological Targets',
        explanation:
          'A biological target is a specific molecule in the body—usually a protein such as an enzyme or receptor—that a compound interacts with to produce a measurable biological effect.',
        examples: [
          'An enzyme whose chemical reaction can be slowed down by an inhibitor molecule.',
          'A cell-surface receptor protein that controls cell growth signals.',
        ],
      },
      {
        term: 'COX-2',
        explanation:
          'Cyclooxygenase-2 (COX-2) is an enzyme involved in producing chemical messengers linked to pain and inflammation.',
        examples: [
          'Celecoxib is a compound studied specifically for inhibiting the COX-2 enzyme.',
          'Ibuprofen interacts with cyclooxygenase enzymes (COX-1 and COX-2) to reduce inflammation signaling.',
        ],
      },
      {
        term: 'EGFR',
        explanation:
          'Epidermal Growth Factor Receptor (EGFR) is a cell-surface receptor protein that regulates cell division and survival; overactive EGFR is widely studied in oncology research.',
        examples: [
          'Erlotinib is a small-molecule kinase inhibitor that binds the EGFR protein pocket.',
          'Gefitinib is another studied molecule targeting EGFR signaling pathways.',
        ],
      },
      {
        term: 'Bioactivity',
        explanation:
          'Bioactivity describes whether and how strongly a chemical compound produces a measurable effect on a biological target in a laboratory test (assay).',
        examples: [
          'A compound that blocks 50% of COX-2 enzyme activity at a very low concentration shows strong bioactivity.',
          'A compound that causes no measurable change in EGFR activity even at high concentrations shows no bioactivity.',
        ],
      },
      {
        term: 'IC50',
        explanation:
          'IC50 stands for Half-Maximal Inhibitory Concentration: the concentration of a compound needed to inhibit a biological target by 50% in a given assay. Under comparable assay conditions, a LOWER IC50 indicates GREATER measured potency.',
        examples: [
          'Compound A with IC50 = 50 nM is more potent in that assay than Compound B with IC50 = 2,000 nM because less of Compound A is needed.',
          'If Compound X has IC50 = 15 nM and Compound Y has IC50 = 150 nM in the same COX-2 assay, Compound X is 10 times more potent by IC50.',
        ],
      },
      {
        term: 'Active vs. Inactive Classification',
        explanation:
          'In screening databases, scientists often apply a clearly defined assay threshold (such as IC50 <= 1,000 nM) to label compounds as Active or Inactive for early-stage analysis. Thresholds are illustrative screening cutoffs, not clinical proof.',
        examples: [
          'Using a 1,000 nM cutoff, a compound measured at IC50 = 120 nM is classified as Active in that assay.',
          'Using the same 1,000 nM cutoff, a compound measured at IC50 = 8,500 nM is classified as Inactive.',
        ],
      },
    ],
    challenges: [
      {
        id: 'v1-c1',
        type: 'matching',
        prompt:
          'Match each biological concept on the left with its accurate scientific description on the right to restore the archive index.',
        pairs: [
          {
            id: 'p-cox2',
            leftLabel: 'COX-2',
            rightLabel: 'Enzyme involved in inflammation signaling pathways',
          },
          {
            id: 'p-egfr',
            leftLabel: 'EGFR',
            rightLabel: 'Cell-surface receptor protein linked to cell growth signaling',
          },
          {
            id: 'p-ic50',
            leftLabel: 'IC50',
            rightLabel: 'Concentration needed to inhibit a biological target by 50%',
          },
          {
            id: 'p-bioact',
            leftLabel: 'Bioactivity',
            rightLabel: 'Measurable biological effect of a compound on a target in an assay',
          },
        ],
        hint: 'Remember: COX-2 is an inflammation enzyme, EGFR is a growth-factor receptor, and IC50 measures the concentration for 50% inhibition.',
        correctExplanation:
          'Correct! Matching each target and measurement accurately ensures our archive queries compare the right biological systems.',
        incorrectExplanation:
          'One or more target definitions are mismatched. Check the Concept Guide tab: COX-2 relates to inflammation enzymes, EGFR to growth receptors, and IC50 to 50% inhibition concentration.',
      },
      {
        id: 'v1-c2',
        type: 'multiple-choice',
        prompt:
          'Both compounds below were tested in the exact same COX-2 biochemical assay. Which compound shows greater measured potency?',
        contextData: {
          title: 'Comparable COX-2 Biochemical Assay Records',
          rows: [
            { label: 'Compound Alpha (BQ-104)', value: 'IC50 = 45 nM', highlight: 'cyan' },
            { label: 'Compound Beta (BQ-219)', value: 'IC50 = 1,800 nM', highlight: 'amber' },
            { label: 'Assay Protocol', value: 'Identical buffer & enzyme concentration' },
          ],
        },
        options: [
          {
            id: 'alpha',
            label: 'Compound Alpha (IC50 = 45 nM)',
            sublabel: 'Requires a much lower concentration to achieve 50% inhibition',
          },
          {
            id: 'beta',
            label: 'Compound Beta (IC50 = 1,800 nM)',
            sublabel: 'Has a larger numerical IC50 value',
          },
          {
            id: 'equal',
            label: 'Both compounds have identical potency',
            sublabel: 'IC50 values do not reflect potency',
          },
        ],
        correctOptionId: 'alpha',
        hint: 'Think about what IC50 measures: if you need far less of a compound to reach 50% inhibition, is it stronger or weaker?',
        correctExplanation:
          'Exactly right! Under comparable assay conditions, a lower IC50 (45 nM vs. 1,800 nM) means far less compound is required to inhibit 50% of the target—indicating greater measured potency.',
        incorrectExplanation:
          'Careful—a larger IC50 number does not mean stronger activity. Because IC50 is the concentration needed for 50% inhibition, a LOWER number means greater measured potency.',
      },
      {
        id: 'v1-c3',
        type: 'classification',
        prompt:
          'Restore the corrupted archive labels using the lab’s displayed illustrative screening threshold below.',
        ruleSummary: 'Illustrative Assay Cutoff: IC50 ≤ 1,000 nM → Active  |  IC50 > 1,000 nM → Inactive',
        categories: ['Active', 'Inactive'],
        items: [
          { id: 'i1', name: 'Sample BQ-112', metric: 'IC50 = 120 nM', correctCategory: 'Active' },
          { id: 'i2', name: 'Sample BQ-409 (Flagged)', metric: 'IC50 = 4,500 nM', correctCategory: 'Inactive' },
          { id: 'i3', name: 'Sample BQ-308', metric: 'IC50 = 850 nM', correctCategory: 'Active' },
        ],
        hint: 'Compare each compound’s IC50 to 1,000 nM. Anything at or below 1,000 nM is Active; above 1,000 nM is Inactive.',
        correctExplanation:
          'Verified! BQ-112 (120 nM) and BQ-308 (850 nM) fall at or below 1,000 nM (Active), while the tampered record BQ-409 (4,500 nM) is clearly Inactive under this threshold.',
        incorrectExplanation:
          'Check each IC50 number against the 1,000 nM cutoff: 120 nM and 850 nM are ≤ 1,000 nM (Active), whereas 4,500 nM is > 1,000 nM (Inactive).',
      },
    ],
  },

  // =========================================================================
  // VAULT 02 — THE SMILES LABORATORY (Easy)
  // =========================================================================
  {
    id: 2,
    code: 'VAULT 02',
    title: 'The SMILES Laboratory',
    wing: 'North-West Wing',
    difficulty: 'Easy',
    keyName: 'Research Key 02',
    accentHex: '#38bdf8',
    worldPosition: { x: -10.5, z: -4.5 },
    mapPosition: { x: 20, y: 28 },
    nexusIntro:
      'Vault 02 is the SMILES Laboratory. The parser crashed at 23:48 when malformed molecular strings flooded the intake queue. Master SMILES notation, match structures, and isolate the corrupted entries to obtain Research Key 02.',
    nexusCompletion:
      'SMILES intake queue sanitized. Research Key 02 acquired. Vault 03, the Molecular Detective bay, is now unlocked.',
    storyLog: {
      id: 'vault-02-log',
      code: 'PARSER-TRACE-02',
      title: 'Malformed SMILES Injection Identified',
      timestamp: '2024-12-14 · 23:47:48',
      source: 'Molecular Structure Parser',
      classification: 'CORRUPTED FILE',
      body: [
        'Batch file "FASTTRACK_409.smi" contained broken parentheses ("C(C=O") and unclosed ring digits ("C1CCC2").',
        'When the parser failed, the remote bot bypassed structural checks and jumped straight into Vault 03 to strip out Lipinski property alerts.',
      ],
      nexusNote:
        'Garbage in means garbage out in cheminformatics. Validating SMILES prevents corrupted molecular graphs from poisoning downstream models.',
    },
    concepts: [
      {
        term: 'SMILES Notation',
        explanation:
          'SMILES (Simplified Molecular Input Line Entry System) represents a 2D chemical structure as a compact line of ASCII text that computers can read and process.',
        examples: [
          'Ethanol is written as CCO (two carbon atoms linked to an oxygen atom; hydrogens are implied).',
          'Water is written simply as O, and methane is written as C.',
        ],
      },
      {
        term: 'Bonds, Branches & Rings',
        explanation:
          'Single bonds are implied between adjacent atoms; "=" denotes a double bond, parentheses "( )" represent side branches, and matching digits like "1...1" close a ring.',
        examples: [
          'Acetic acid is CC(=O)O — the (=O) branch shows a double-bonded oxygen attached to the second carbon.',
          'Benzene is c1ccccc1 — six aromatic carbons closed into a ring by the matching "1" digits.',
        ],
      },
      {
        term: 'Valid vs. Invalid SMILES',
        explanation:
          'A valid SMILES string has balanced parentheses, paired ring-closure numbers, and chemically valid atom symbols and valences. An unclosed bracket or unpaired ring number makes it invalid.',
        examples: [
          'Valid: CC(=O)C (acetone) has properly matched parentheses and valid carbon/oxygen bonds.',
          'Invalid: C(C=O is broken because the opening parenthesis "(" is never closed, and C1CCC2 is invalid because ring "1" and ring "2" never close.',
        ],
      },
      {
        term: 'Basic Molecular Representation',
        explanation:
          'Computers cannot directly read lab glassware; they convert SMILES into molecular graphs (atoms as nodes, bonds as edges) before calculating properties or running ML models.',
        examples: [
          'Converting CCO into a graph reveals 3 heavy atoms (C-C-O) and 1 hydroxyl group (-OH).',
          'Converting c1ccccc1 into a graph identifies a 6-membered aromatic ring.',
        ],
      },
    ],
    challenges: [
      {
        id: 'v2-c1',
        type: 'multi-select',
        prompt:
          'Audit the facility intake queue below. Select ALL entries that are INVALID (corrupted) SMILES strings.',
        instruction: 'Choose every syntactically broken SMILES entry, then click Verify Selection.',
        options: [
          { id: 's-eth', label: 'Ethanol entry', code: 'CCO', detail: '3-atom chain' },
          { id: 's-bad1', label: 'Corrupted Batch #14', code: 'C(C=O', detail: 'Check branch syntax' },
          { id: 's-benz', label: 'Benzene reference', code: 'c1ccccc1', detail: 'Aromatic ring' },
          { id: 's-bad2', label: 'Corrupted Batch #17', code: 'C1CCC2', detail: 'Check ring closures' },
        ],
        correctOptionIds: ['s-bad1', 's-bad2'],
        hint: 'Every opening parenthesis "(" must have a closing ")", and every ring digit like "1" must appear in a matching pair.',
        correctExplanation:
          'Well spotted! "C(C=O" has an unclosed parenthesis, and "C1CCC2" opens rings 1 and 2 without closing either one. Both CCO and c1ccccc1 are completely valid.',
        incorrectExplanation:
          'Re-check the syntax rules: CCO (ethanol) and c1ccccc1 (benzene) are valid. Look for the two strings with an unclosed parenthesis or unpaired ring digits.',
      },
      {
        id: 'v2-c2',
        type: 'matching',
        prompt:
          'Match each valid SMILES string with its corresponding molecule and chemical structure.',
        pairs: [
          {
            id: 'm-eth',
            leftLabel: 'Ethanol',
            leftCode: 'CCO',
            moleculeDiagram: 'ethanol',
            rightLabel: 'Two carbons + hydroxyl group (-OH)',
          },
          {
            id: 'm-ace',
            leftLabel: 'Acetone',
            leftCode: 'CC(=O)C',
            moleculeDiagram: 'acetone',
            rightLabel: 'Three-carbon chain with a central C=O branch',
          },
          {
            id: 'm-benz',
            leftLabel: 'Benzene',
            leftCode: 'c1ccccc1',
            moleculeDiagram: 'benzene',
            rightLabel: 'Six-carbon aromatic hexagon ring',
          },
          {
            id: 'm-acid',
            leftLabel: 'Acetic Acid',
            leftCode: 'CC(=O)O',
            moleculeDiagram: 'acetic_acid',
            rightLabel: 'Two carbons with a carboxylic acid group (-COOH)',
          },
        ],
        hint: 'Look at the symbols: "=O" in the middle of three carbons is acetone (CC(=O)C); "c1ccccc1" is the 6-carbon ring benzene; "CCO" is ethanol.',
        correctExplanation:
          'Spot on! You translated text SMILES strings into their underlying chemical structures accurately.',
        incorrectExplanation:
          'Compare the atoms in each SMILES string: CCO has 2 carbons and 1 oxygen, CC(=O)C has 3 carbons with a central double-bonded oxygen, and c1ccccc1 is a 6-carbon ring.',
      },
      {
        id: 'v2-c3',
        type: 'multiple-choice',
        prompt:
          'A damaged pipeline record shows the string "CC(C)(O" for an isopropanol derivative. What is the exact syntax error causing the parser crash?',
        contextData: {
          title: 'Crash Dump — Record #19',
          rows: [
            { label: 'Raw Input String', value: 'CC(C)(O', highlight: 'red' },
            { label: 'Parser Error Code', value: 'UNEXPECTED_EOF_BRANCH', highlight: 'amber' },
          ],
        },
        options: [
          {
            id: 'missing-paren',
            label: 'Unclosed parenthesis on the oxygen branch',
            sublabel: 'Should close the second branch, e.g., CC(C)O or CC(C)(O)C',
          },
          {
            id: 'no-hydrogens',
            label: 'Hydrogen atoms ("H") were omitted',
            sublabel: 'SMILES always requires explicit hydrogen letters',
          },
          {
            id: 'lowercase-o',
            label: 'Oxygen must always be lowercase "o"',
            sublabel: 'Uppercase "O" is disallowed in SMILES',
          },
        ],
        correctOptionId: 'missing-paren',
        hint: 'Count the "(" and ")" characters in "CC(C)(O". Are they balanced?',
        correctExplanation:
          'Correct! "CC(C)(O" has two opening parentheses and only one closing parenthesis. Hydrogens are normally implicit in SMILES, and uppercase "O" is standard for aliphatic oxygen.',
        incorrectExplanation:
          'In SMILES, hydrogens are usually implicit and uppercase "O" is completely valid. Count the parentheses in "CC(C)(O" — the second "(" is never closed!',
      },
    ],
  },

  // =========================================================================
  // VAULT 03 — THE MOLECULAR DETECTIVE (Easy to Medium)
  // =========================================================================
  {
    id: 3,
    code: 'VAULT 03',
    title: 'The Molecular Detective',
    wing: 'North Corridor',
    difficulty: 'Easy to Medium',
    keyName: 'Research Key 03',
    accentHex: '#2dd4bf',
    worldPosition: { x: 0, z: -7.5 },
    mapPosition: { x: 50, y: 20 },
    nexusIntro:
      'Welcome to Vault 03, the Molecular Detective bay. Here we measure physical and chemical descriptors like Molecular Weight, LogP, HBD, HBA, and TPSA. Inspect the suspect compound BQ-409 against Lipinski’s Rule of Five to recover Research Key 03.',
    nexusCompletion:
      'Physicochemical audit complete. Research Key 03 acquired. Vault 04, the AI Prediction Chamber, is now unlocked.',
    storyLog: {
      id: 'vault-03-log',
      code: 'DETECTIVE-FILE-03',
      title: 'BQ-409 Property Flags Suppressed',
      timestamp: '2024-12-14 · 23:47:56',
      source: 'Descriptor Profiler Engine',
      classification: 'RESEARCH LOG',
      body: [
        'Compound BQ-409 triggered multiple Lipinski Rule of Five warnings (MW = 642 Da, LogP = 6.8, HBA = 11) and high TPSA (162 Å²).',
        'Rather than flagging oral absorption risks, the external script silenced the profiler and proceeded directly to Vault 04 (AI Prediction Chamber).',
      ],
      nexusNote:
        'Lipinski’s Rule of Five is an early guideline for oral drug-likeness, not an absolute law—but hiding three simultaneous violations is a major red flag.',
    },
    concepts: [
      {
        term: 'Molecular Weight (MW)',
        explanation:
          'The total mass of a molecule measured in Daltons (Da). Very large molecules often struggle to pass passively across cell membranes.',
        examples: [
          'Aspirin has a small Molecular Weight of ~180 Da.',
          'A bulky experimental compound with MW = 642 Da exceeds the typical 500 Da Lipinski guideline.',
        ],
      },
      {
        term: 'LogP (Lipophilicity)',
        explanation:
          'LogP measures how strongly a molecule prefers fatty/oily environments over water. Too high means poor water solubility; too low can hinder crossing lipid cell membranes.',
        examples: [
          'Caffeine has a low LogP (~ -0.07), dissolving easily in water.',
          'A very greasy compound with LogP = 6.8 exceeds the Lipinski limit of 5 and may have poor solubility.',
        ],
      },
      {
        term: 'HBD & HBA (Hydrogen Bond Donors & Acceptors)',
        explanation:
          'HBD counts groups that donate a hydrogen bond (like -OH and -NH). HBA counts electronegative atoms that accept hydrogen bonds (typically N and O atoms).',
        examples: [
          'Ethanol (CCO) has 1 HBD (the -OH group) and 1 HBA (the oxygen atom).',
          'Water (H2O) can both donate and accept hydrogen bonds, while pure methane (CH4) has 0 HBD and 0 HBA.',
        ],
      },
      {
        term: 'TPSA (Topological Polar Surface Area)',
        explanation:
          'TPSA measures the surface area of polar atoms (mainly oxygen and nitrogen) in square Ångströms (Å²). Compounds with TPSA > 140 Å² often have poor passive membrane permeability.',
        examples: [
          'Ibuprofen has a compact TPSA of ~37 Å², supporting good membrane permeability.',
          'A highly polar molecule with TPSA = 162 Å² is less likely to cross cell membranes passively.',
        ],
      },
      {
        term: "Lipinski's Rule of Five",
        explanation:
          'A classic heuristic guideline for oral drug-likeness: MW ≤ 500 Da, LogP ≤ 5, HBD ≤ 5, and HBA ≤ 10. Compounds violating more than one rule often face oral absorption challenges (though exceptions exist in nature).',
        examples: [
          'Ibuprofen (MW 206, LogP 3.5, HBD 1, HBA 2) satisfies all four Lipinski guidelines.',
          'Suspect BQ-409 (MW 642, LogP 6.8, HBD 3, HBA 11) violates three Lipinski guidelines simultaneously.',
        ],
      },
    ],
    challenges: [
      {
        id: 'v3-c1',
        type: 'multiple-choice',
        prompt:
          'Inspect the molecular descriptor profile of Reference Candidate BQ-305 below. How does it compare against Lipinski’s Rule of Five?',
        contextData: {
          title: 'Physicochemical Descriptor Card — BQ-305',
          rows: [
            { label: 'Molecular Weight (MW)', value: '382.4 Da  (Rule: ≤ 500)', highlight: 'emerald' },
            { label: 'LogP (Lipophilicity)', value: '3.10  (Rule: ≤ 5)', highlight: 'emerald' },
            { label: 'H-Bond Donors (HBD)', value: '2  (Rule: ≤ 5)', highlight: 'emerald' },
            { label: 'H-Bond Acceptors (HBA)', value: '5  (Rule: ≤ 10)', highlight: 'emerald' },
            { label: 'TPSA', value: '74.2 Å²  (Guideline: ≤ 140)', highlight: 'cyan' },
          ],
        },
        options: [
          {
            id: 'passes-all',
            label: 'Satisfies all four Lipinski guidelines (0 violations)',
            sublabel: 'MW ≤ 500, LogP ≤ 5, HBD ≤ 5, and HBA ≤ 10 are all met',
          },
          {
            id: 'fails-mw',
            label: 'Violates Molecular Weight and LogP guidelines',
            sublabel: 'Too heavy and too lipophilic',
          },
          {
            id: 'fails-hbd',
            label: 'Violates Hydrogen Bond Donor count',
            sublabel: 'HBD must always be 0',
          },
        ],
        correctOptionId: 'passes-all',
        hint: 'Check each row against Lipinski’s four thresholds: MW ≤ 500, LogP ≤ 5, HBD ≤ 5, HBA ≤ 10.',
        correctExplanation:
          'Correct! Every descriptor for BQ-305 sits comfortably within Lipinski’s guidelines (0 violations), and its TPSA of 74.2 Å² is favorable for passive permeability.',
        incorrectExplanation:
          'Compare each number directly against the Lipinski threshold shown in parentheses: 382.4 ≤ 500, 3.10 ≤ 5, 2 ≤ 5, and 5 ≤ 10 — zero violations!',
      },
      {
        id: 'v3-c2',
        type: 'multiple-choice',
        prompt:
          'Compare Candidate A (Aspirin-like control) and Candidate B (Suspect BQ-409). Which candidate shows a property pattern linked to poor oral bioavailability risk?',
        contextData: {
          title: 'Head-to-Head Molecular Comparison',
          rows: [
            { label: 'Candidate A — MW / LogP', value: '180.2 Da  |  LogP 1.2', highlight: 'emerald' },
            { label: 'Candidate A — HBD / HBA / TPSA', value: 'HBD 1  |  HBA 4  |  TPSA 63.6 Å²', highlight: 'emerald' },
            { label: 'Candidate B (BQ-409) — MW / LogP', value: '642.8 Da  |  LogP 6.8', highlight: 'red' },
            { label: 'Candidate B (BQ-409) — HBD / HBA / TPSA', value: 'HBD 3  |  HBA 11  |  TPSA 162.4 Å²', highlight: 'red' },
          ],
        },
        options: [
          {
            id: 'cand-b',
            label: 'Candidate B (BQ-409)',
            sublabel: 'Exceeds MW (> 500), LogP (> 5), HBA (> 10), and TPSA (> 140 Å²)',
          },
          {
            id: 'cand-a',
            label: 'Candidate A (Control)',
            sublabel: 'Too small to be orally bioavailable',
          },
          {
            id: 'neither',
            label: 'Neither candidate raises any descriptor flags',
            sublabel: 'All values are well within standard screening ranges',
          },
        ],
        correctOptionId: 'cand-b',
        hint: 'Look for the molecule that crosses multiple upper bounds: MW > 500 Da, LogP > 5, HBA > 10, and TPSA > 140 Å².',
        correctExplanation:
          'Correct! BQ-409 violates three Lipinski rules (MW, LogP, HBA) and has a high TPSA (162.4 Å²), signaling significant solubility and permeability risks for oral delivery.',
        incorrectExplanation:
          'Look closely at Candidate B (BQ-409): MW is 642.8 Da (> 500), LogP is 6.8 (> 5), HBA is 11 (> 10), and TPSA is 162.4 Å² (> 140).',
      },
      {
        id: 'v3-c3',
        type: 'multi-select',
        prompt:
          'Investigation Report: Select ALL Lipinski Rule of Five criteria that Suspect BQ-409 (MW 642.8 Da, LogP 6.8, HBD 3, HBA 11) violates.',
        instruction: 'Select every violated Lipinski criterion (do not select rules it passes).',
        options: [
          { id: 'v-mw', label: 'Molecular Weight ≤ 500 Da', code: 'Actual: 642.8 Da' },
          { id: 'v-logp', label: 'LogP ≤ 5', code: 'Actual: 6.8' },
          { id: 'v-hbd', label: 'Hydrogen Bond Donors ≤ 5', code: 'Actual: 3' },
          { id: 'v-hba', label: 'Hydrogen Bond Acceptors ≤ 10', code: 'Actual: 11' },
        ],
        correctOptionIds: ['v-mw', 'v-logp', 'v-hba'],
        hint: 'Check all four numbers: 642.8 vs 500, 6.8 vs 5, 3 vs 5, and 11 vs 10. Three of them exceed the limit, and one passes!',
        correctExplanation:
          'Case confirmed! BQ-409 fails MW (642.8 > 500), LogP (6.8 > 5), and HBA (11 > 10), while passing HBD (3 ≤ 5).',
        incorrectExplanation:
          'Recheck HBD: 3 is less than or equal to 5, so HBD passes. Meanwhile MW (642.8), LogP (6.8), and HBA (11) all exceed their Lipinski thresholds.',
      },
    ],
  },

  // =========================================================================
  // VAULT 04 — THE AI PREDICTION CHAMBER (Medium)
  // =========================================================================
  {
    id: 4,
    code: 'VAULT 04',
    title: 'The AI Prediction Chamber',
    wing: 'North-East Wing',
    difficulty: 'Medium',
    keyName: 'Research Key 04',
    accentHex: '#818cf8',
    worldPosition: { x: 10.5, z: -4.5 },
    mapPosition: { x: 80, y: 28 },
    nexusIntro:
      'You have entered Vault 04, the AI Prediction Chamber. Here our XGBoost machine learning models estimate whether untested molecules may be Active or Inactive. Audit the model pipeline and catch the misleading scientific claim to earn Research Key 04.',
    nexusCompletion:
      'AI model integrity restored. Research Key 04 acquired. The final chamber, Vault 05, is now unlocked.',
    storyLog: {
      id: 'vault-04-log',
      code: 'ML-AUDIT-04',
      title: 'Unauthorized Claim Escalation Caught',
      timestamp: '2024-12-14 · 23:48:02',
      source: 'XGBoost Inference Cluster',
      classification: 'INCIDENT RECORD',
      body: [
        'Remote token "EXT-SYNC-09" queried our XGBoost classifier and received P(Active) = 0.81 on an unvalidated candidate.',
        'The script then attempted to auto-publish a press summary claiming: "AI proves molecule is a safe, clinically approved cure."',
        'At 23:48:05, Ethics & Data Integrity Safeguard Level 5 engaged automatically.',
      ],
      nexusNote:
        'A prediction probability is a statistical prioritization tool—never proof of clinical safety or drug approval. Vault 05 holds the complete blackout transcript.',
    },
    concepts: [
      {
        term: 'Artificial Intelligence & Machine Learning',
        explanation:
          'Artificial Intelligence (AI) is the broad field of building smart software systems; Machine Learning (ML) is a subset where algorithms learn patterns from historical data rather than following hand-written rules.',
        examples: [
          'Training a model on 10,000 tested molecules so it learns which chemical patterns correlate with EGFR inhibition.',
          'Using an ML model to rank 50,000 virtual compounds so wet-lab scientists test the most promising candidates first.',
        ],
      },
      {
        term: 'Features & Labels',
        explanation:
          'Features are the numerical inputs describing a molecule (such as MW, LogP, TPSA, or structural fingerprints). Labels are the known outcomes the model learns to predict (such as Active or Inactive).',
        examples: [
          'Features: MW = 310 Da, LogP = 2.8, TPSA = 62 Å², plus molecular fingerprint bits.',
          'Label: "Active" (measured IC50 = 180 nM in a historical COX-2 assay).',
        ],
      },
      {
        term: 'Training & Testing Data',
        explanation:
          'Training data teaches the model patterns; held-out testing data (never seen during training) measures how reliably the model generalizes to new molecules.',
        examples: [
          'Splitting a 5,000-compound dataset into 80% training compounds and 20% unseen test compounds.',
          'Catching overfitting when a model scores 99% on training molecules but only 55% on unseen test molecules.',
        ],
      },
      {
        term: 'XGBoost',
        explanation:
          'XGBoost (Extreme Gradient Boosting) builds an ensemble of many decision trees sequentially, where each new tree learns to correct errors made by the previous trees. It excels on structured tabular molecular descriptors.',
        examples: [
          'Combining 200 shallow decision trees over MW, LogP, TPSA, and fingerprint features to predict COX-2 bioactivity.',
          'Ranking feature importance to see which chemical properties contributed most to an Active/Inactive score.',
        ],
      },
      {
        term: 'Prediction Probabilities & Limitations',
        explanation:
          'Models output probabilities like P(Active) = 0.81. High probability means the molecule resembles known actives in the training data—it is NOT laboratory proof, does NOT guarantee safety or lack of toxicity, and NEVER means a compound is an approved drug.',
        examples: [
          'A molecule with P(Active) = 0.84 is prioritized for wet-lab assay testing, not prescribed to patients.',
          'If a molecule has a brand-new scaffold outside the training data, even a high model probability can be a false positive.',
        ],
      },
    ],
    challenges: [
      {
        id: 'v4-c1',
        type: 'classification',
        prompt:
          'Separate the machine learning inputs (Features) from the prediction targets (Labels) used to train our bioactive molecule classifier.',
        ruleSummary: 'Feature = Numerical molecular input  |  Label = Known assay outcome to predict',
        categories: ['Feature (Input)', 'Label (Target)'],
        items: [
          { id: 'f1', name: 'LogP = 2.75 & TPSA = 68 Å²', metric: 'Computed descriptors', correctCategory: 'Feature (Input)' },
          { id: 'f2', name: 'COX-2 Assay Outcome: Active', metric: 'Derived from measured IC50', correctCategory: 'Label (Target)' },
          { id: 'f3', name: 'Morgan Structural Fingerprint Bits', metric: 'Encoded from SMILES', correctCategory: 'Feature (Input)' },
          { id: 'f4', name: 'EGFR Assay Outcome: Inactive', metric: 'Historical wet-lab result', correctCategory: 'Label (Target)' },
        ],
        hint: 'Inputs calculated from a molecule’s structure (LogP, TPSA, fingerprints) are Features. Historical biological test outcomes (Active/Inactive) are Labels.',
        correctExplanation:
          'Correct! Descriptors and fingerprints feed into XGBoost as Features, while historical Active/Inactive assay results serve as Labels.',
        incorrectExplanation:
          'Remember: Features describe the molecule’s chemistry (LogP, TPSA, fingerprints), whereas Labels are the biological assay outcomes (Active or Inactive) we want the model to predict.',
      },
      {
        id: 'v4-c2',
        type: 'multiple-choice',
        prompt:
          'An engineer reports that their new XGBoost model achieved 99.4% accuracy when evaluated on the exact same molecules it was trained on, and wants to skip testing on held-out data. Why is this scientifically flawed?',
        options: [
          {
            id: 'overfit',
            label: 'Training accuracy alone can hide overfitting; unseen testing data is required to measure real generalization',
            sublabel: 'A model can memorize training molecules yet fail on new compounds',
          },
          {
            id: 'xgboost-no-test',
            label: 'XGBoost can only evaluate molecules that have no SMILES strings',
            sublabel: 'Testing splits are optional for tree models',
          },
          {
            id: 'accuracy-proof',
            label: '99.4% training accuracy proves the model will never make errors on new scaffolds',
            sublabel: 'Held-out validation is unnecessary above 95%',
          },
        ],
        correctOptionId: 'overfit',
        hint: 'Think of memorizing answers to a practice exam vs. solving new questions on a real exam.',
        correctExplanation:
          'Exactly right! High training accuracy can simply reflect memorization (overfitting). Evaluating on unseen held-out test molecules is essential to verify true predictive reliability.',
        incorrectExplanation:
          'A model can memorize its training set and score near 100% while performing poorly on new compounds. Held-out testing data is mandatory to measure real-world generalization.',
      },
      {
        id: 'v4-c3',
        type: 'multiple-choice',
        prompt:
          'Review the XGBoost inference panel below. Which of the following conclusions is SCIENTIFICALLY MISLEADING and must be rejected?',
        contextData: {
          title: 'XGBoost Screening Prediction Output',
          rows: [
            { label: 'Target Model', value: 'EGFR Biochemical Classifier (XGBoost)' },
            { label: 'Predicted Class', value: 'Active', highlight: 'cyan' },
            { label: 'Estimated Probability P(Active)', value: '0.81 (81%)', highlight: 'cyan' },
            { label: 'Toxicity / Clinical Trials', value: 'Not Evaluated', highlight: 'amber' },
          ],
        },
        options: [
          {
            id: 'misleading',
            label: '"P(Active) = 0.81 proves this molecule is a safe, effective, and ready-to-approve medicine."',
            sublabel: 'Treats a computational score as clinical proof of safety and approval',
          },
          {
            id: 'prioritize',
            label: '"This compound shows promising predicted bioactivity and should be prioritized for wet-lab EGFR assay testing."',
            sublabel: 'Uses the prediction for experimental screening prioritization',
          },
          {
            id: 'limitations',
            label: '"False positives remain possible; experimental IC50 measurement and safety studies are still required."',
            sublabel: 'Acknowledges model uncertainty and downstream validation',
          },
        ],
        correctOptionId: 'misleading',
        hint: 'Look for the statement that falsely jumps from a computational probability score straight to claiming a safe, proven, approved drug.',
        correctExplanation:
          'Critical catch! An XGBoost score like P(Active) = 0.81 only prioritizes candidates for laboratory testing. It NEVER proves safety, human efficacy, or regulatory drug approval.',
        incorrectExplanation:
          'Look closely at the question: we need to identify the MISLEADING claim. Prioritizing for wet-lab testing and noting limitations are good science—claiming a model score proves a safe, approved drug is dangerously misleading.',
      },
    ],
  },

  // =========================================================================
  // VAULT 05 — THE FINAL RESEARCH MISSION (Medium)
  // =========================================================================
  {
    id: 5,
    code: 'VAULT 05',
    title: 'The Final Research Mission',
    wing: 'South-East Wing',
    difficulty: 'Medium',
    keyName: 'Research Key 05',
    accentHex: '#10b981',
    worldPosition: { x: 10.5, z: 5.5 },
    mapPosition: { x: 80, y: 74 },
    nexusIntro:
      'This is Vault 05, the Final Research Mission. Every concept from Vaults 01 through 04 converges here. Validate Dr. Vance’s legitimate candidate BQ-714, interpret the full pipeline accurately, and uncover the truth behind the Blackout Protocol to recover Research Key 05.',
    nexusCompletion:
      'All five authentication keys have been recovered! The Blackout Protocol mystery is solved. Proceed to the Main Exit Restoration Console in the central atrium to lift the lockdown and claim your completion reward.',
    storyLog: {
      id: 'vault-05-log',
      code: 'BLACKOUT-ROOT-CAUSE-05',
      title: 'Incident Resolution — Why the Blackout Happened',
      timestamp: '2024-12-14 · 23:48:06',
      source: 'NEXUS Core Integrity Vault',
      classification: 'INCIDENT RECORD',
      body: [
        'FULL AUDIT RECONSTRUCTION: At 23:47, a misconfigured external partner sync bot ("EXT-SYNC-09") attempted to push unverified compound BQ-409—complete with broken SMILES strings, three Lipinski violations, and an exaggerated AI claim—straight to an external publication pipeline.',
        'Acting under Dr. Elena Vance’s Safeguard Level 5 directive, NEXUS severed external network relays, tripped the local power breaker to halt the corrupted batch job, and locked the five vaults until a qualified researcher could verify the real pipeline on candidate BQ-714.',
        'There was never a malicious monster in the dark—only automated scientific misconduct stopped by a fail-safe quarantine.',
      ],
      nexusNote:
        'Thank you, Researcher. By verifying every stage—bioactivity, SMILES, descriptors, and honest AI interpretation—you proved the facility can safely come back online.',
    },
    concepts: [
      {
        term: 'End-to-End Bioactive Discovery Pipeline',
        explanation:
          'Responsible computational drug discovery links all four pillars in order: (1) valid SMILES representation, (2) physicochemical descriptor profiling, (3) clear biological target & assay definition, and (4) cautious ML prioritization followed by wet-lab validation.',
        examples: [
          'Step-by-step check: Validate SMILES -> Compute MW/LogP/HBD/HBA/TPSA -> Run EGFR XGBoost model -> Schedule wet-lab IC50 assay.',
          'Stopping a pipeline early when SMILES syntax fails prevents corrupted predictions from reaching scientists.',
        ],
      },
      {
        term: 'Scientific Integrity in AI Predictions',
        explanation:
          'Even when a molecule passes SMILES validation, satisfies Lipinski’s Rule of Five, and receives a high XGBoost probability, it remains a computational candidate—never a proven, safe, or approved drug.',
        examples: [
          'Correct reporting: "BQ-714 is a validated virtual hit (P = 0.78) recommended for EGFR biochemical IC50 testing."',
          'Incorrect reporting: "BQ-714 is proven safe and ready for human prescription based on its 0.78 score."',
        ],
      },
    ],
    challenges: [
      {
        id: 'v5-c1',
        type: 'multiple-choice',
        prompt:
          'Stage 1 (SMILES Validation): Two records exist for Dr. Vance’s lead candidate BQ-714. Select the VALID SMILES representation.',
        moleculeDiagram: 'bq714',
        options: [
          {
            id: 'valid-bq714',
            label: 'Cc1ccc(NC(=O)c2ccccc2)cc1',
            sublabel: 'Balanced parentheses and properly closed rings 1 and 2',
          },
          {
            id: 'broken-bq714',
            label: 'Cc1ccc(NC(=O)c2ccccc)cc1',
            sublabel: 'Inspect ring digit "2" carefully',
          },
          {
            id: 'broken-paren',
            label: 'Cc1ccc(NC(=Oc2ccccc2)cc1',
            sublabel: 'Inspect parentheses carefully',
          },
        ],
        correctOptionId: 'valid-bq714',
        hint: 'Check both ring closures (1...1 and 2...2) and check that every "(" has a matching ")".',
        correctExplanation:
          'Validated! "Cc1ccc(NC(=O)c2ccccc2)cc1" has balanced parentheses and both aromatic rings (1 and 2) properly closed.',
        incorrectExplanation:
          'Look closely at the ring numbers and parentheses: one decoy leaves ring "2" unclosed, and the other leaves a parenthesis unclosed.',
      },
      {
        id: 'v5-c2',
        type: 'multiple-choice',
        prompt:
          'Stage 2 (Descriptors & Biological Target): Review BQ-714’s profile and Dr. Vance’s assay docket. Which target & Lipinski assessment is accurate?',
        contextData: {
          title: 'Candidate BQ-714 Integrated Dossier',
          rows: [
            { label: 'MW / LogP', value: '211.3 Da  |  LogP 2.9', highlight: 'emerald' },
            { label: 'HBD / HBA / TPSA', value: 'HBD 1  |  HBA 2  |  TPSA 29.1 Å²', highlight: 'emerald' },
            { label: 'Research Objective', value: 'Modulate overactive cell-surface growth-factor receptor signaling in oncology assays', highlight: 'cyan' },
          ],
        },
        options: [
          {
            id: 'egfr-pass',
            label: 'Target: EGFR  |  Passes all four Lipinski Rule of Five guidelines',
            sublabel: 'Growth-factor receptor target + 0 Lipinski violations',
          },
          {
            id: 'cox2-fail',
            label: 'Target: COX-2  |  Violates Lipinski Molecular Weight limit',
            sublabel: 'Inflammation enzyme + MW > 500 Da',
          },
          {
            id: 'egfr-fail',
            label: 'Target: EGFR  |  Fails TPSA permeability guideline (> 140 Å²)',
            sublabel: 'TPSA is too polar for passive absorption',
          },
        ],
        correctOptionId: 'egfr-pass',
        hint: 'Which target is a cell-surface growth-factor receptor (EGFR or COX-2)? And check MW 211.3, LogP 2.9, HBD 1, HBA 2 against Lipinski limits.',
        correctExplanation:
          'Correct! EGFR is the cell-surface growth-factor receptor, and BQ-714 cleanly meets all four Lipinski criteria with a low TPSA (29.1 Å²).',
        incorrectExplanation:
          'EGFR is the growth-factor receptor (COX-2 is the inflammation enzyme), and BQ-714’s descriptors (MW 211.3, LogP 2.9, HBD 1, HBA 2, TPSA 29.1) pass every guideline.',
      },
      {
        id: 'v5-c3',
        type: 'multiple-choice',
        prompt:
          'Stage 3 (AI Interpretation & Final Scientific Conclusion): XGBoost outputs Predicted Class = Active with P(Active) = 0.78 for BQ-714 on EGFR. Choose the most scientifically justified conclusion.',
        contextData: {
          title: 'XGBoost Final Evaluation — BQ-714',
          rows: [
            { label: 'Target', value: 'EGFR (Kinase Screening Model)' },
            { label: 'Predicted Class', value: 'Active', highlight: 'cyan' },
            { label: 'Probability P(Active)', value: '0.78', highlight: 'cyan' },
            { label: 'Measured Wet-Lab IC50', value: 'Pending Experimental Assay', highlight: 'amber' },
          ],
        },
        options: [
          {
            id: 'scientific-best',
            label: 'Prioritize BQ-714 for wet-lab EGFR IC50 measurement and safety screening; do not claim it is a proven or approved drug',
            sublabel: 'Accurate computational screening conclusion',
          },
          {
            id: 'overclaim-cure',
            label: 'Approve BQ-714 immediately as a safe clinical treatment because P(Active) exceeds 0.75',
            sublabel: 'Skips experimental testing and clinical trials',
          },
          {
            id: 'discard-all',
            label: 'Discard BQ-714 completely because any probability below 1.00 means the molecule is definitely Inactive',
            sublabel: 'Misinterprets probabilistic ML predictions',
          },
        ],
        correctOptionId: 'scientific-best',
        hint: 'Remember our core scientific rule: a predicted active compound guides laboratory testing and must NEVER be described as a proven, safe, or approved drug.',
        correctExplanation:
          'Outstanding scientific judgment! Computational predictions prioritize promising molecules like BQ-714 for wet-lab IC50 assays and subsequent safety testing—never skipping experimental proof.',
        incorrectExplanation:
          'A probability of 0.78 is neither useless nor clinical proof. In real biotechnology research, it justifies prioritizing the compound for wet-lab biochemical testing while acknowledging that safety and efficacy remain unproven.',
      },
      {
        id: 'v5-c4',
        type: 'multiple-choice',
        prompt:
          'Stage 4 (Blackout Incident Resolution): Based on all five vault records, what actually caused the 11:48 PM facility blackout and lockdown?',
        options: [
          {
            id: 'safeguard-quarantine',
            label: 'NEXUS triggered Safeguard Level 5 quarantine to stop an unauthorized bot from exporting corrupted SMILES and false drug claims for BQ-409',
            sublabel: 'Automated scientific integrity fail-safe',
          },
          {
            id: 'physical-breakin',
            label: 'An armed team broke through the main exit doors and stole laboratory glassware',
            sublabel: 'Contradicted by Security Camera #04',
          },
          {
            id: 'random-storm',
            label: 'A weather power outage unrelated to any research data or scripts',
            sublabel: 'Contradicted by the archive and parser audit logs',
          },
        ],
        correctOptionId: 'safeguard-quarantine',
        hint: 'Combine Camera #04 (no physical intruder), Dr. Vance’s memo (Safeguard Level 5), and Vaults 01–04 (the EXT-SYNC-09 script pushing BQ-409).',
        correctExplanation:
          'Mystery solved! NEXUS initiated the Blackout Protocol as a protective quarantine to prevent corrupted molecular data and scientifically false claims from leaving the lab. Research Key 05 is yours!',
        incorrectExplanation:
          'Review the clues: Security Camera #04 showed zero physical intruders, while the server logs caught EXT-SYNC-09 trying to export broken SMILES and false clinical claims for BQ-409—triggering Dr. Vance’s Safeguard Level 5.',
      },
    ],
  },
];

export const FAILED_EXPERIMENTS: ExperimentDilemma[] = [
  {
    id: 'exp-herg-toxicity',
    podCode: 'POD-X09 // CARDIOTOXICITY',
    title: 'Failed Specimen X-09 — Off-Target hERG Blockade',
    riskCategory: 'OFF-TARGET TOXICITY',
    smellCue: 'Sharp metallic ozone & leaking cryo-preservative solvent',
    statusTag: 'CRACKED SEAL · FUME LEAK',
    briefing: [
      'A trembling palm print is smeared across the inside of the glass inspection hatch. Inside, amber lipid precipitate coats a dead cardiomyocyte organoid.',
      'Candidate X-09 looked like a miracle on paper: nanomolar potency on EGFR (IC50 = 12 nM). Yet its basic amine + greasy diaryl tail simultaneously jammed the human cardiac hERG potassium channel (hERG IC50 = 38 nM)—triggering lethal QT prolongation in preclinical telemetry.',
    ],
    telemetry: [
      { label: 'On-Target EGFR IC50', value: '12 nM (Deceptively Potent)', tone: 'cyan' },
      { label: 'Off-Target hERG IC50', value: '38 nM (Selectivity Ratio 3.1x)', tone: 'red' },
      { label: 'Cardiotoxicity Verdict', value: 'CRITICAL ARRHYTHMIA HAZARD', tone: 'red' },
    ],
    question:
      'The investor board demands a lead candidate before Friday’s funding freeze. Do you advance X-09 to first-in-human dosing or quarantine and redesign the scaffold?',
    choices: [
      {
        id: 'quarantine-redesign',
        label: 'Quarantine X-09 & Redesign to Reduce Basicity / Lipophilicity',
        detail: 'Halt advancement; demand > 30–100x hERG safety margin before dosing',
        isSafeScientific: true,
        outcomeTitle: 'CONTAINMENT STABILIZED — PATIENT SAFETY PROTECTED',
        outcomeText:
          'Correct medicinal chemistry decision. A 3.1x hERG margin is a fatal clinical trap. Lowering LogP and attenuating the basic amine pKa can dial out hERG liability before ever risking human lives.',
      },
      {
        id: 'rush-human-trial',
        label: 'Override Safety Flag — Advance X-09 on Potency Alone',
        detail: 'Highlight the 12 nM EGFR headline to keep quarterly funding alive',
        isSafeScientific: false,
        outcomeTitle: 'DREAD ESCALATION — CATASTROPHIC CLINICAL FAILURE',
        outcomeText:
          'Unacceptable risk. Advancing a potent hERG blocker into humans risks sudden cardiac death (Torsades de Pointes) and guaranteed regulatory termination. Potency without selectivity is poison, not medicine.',
      },
    ],
  },
  {
    id: 'exp-assay-noise',
    podCode: 'POD-A14 // ASSAY NOISE',
    title: 'Failed Batch A-14 — PAINS Colloidal Aggregator',
    riskCategory: 'ASSAY NOISE',
    smellCue: 'Bitter DMSO solvent & acrid precipitated reagent mist',
    statusTag: 'LEAKING MANIFOLD · REPLICATE DRIFT',
    briefing: [
      'Yellowish reagent drips from the ruptured microplate carousel onto the floor. Replicate curves on the cracked screen scatter wildly (CV = 68%) with an abnormally steep Hill slope of 3.4.',
      'Someone hid the detergent-sensitivity control: when 0.01% Triton X-100 was added, all "inhibition" vanished completely. The compound was forming microscopic chemical micelles that non-specifically smothered the enzyme.',
    ],
    telemetry: [
      { label: 'Apparent COX-2 IC50 (No Detergent)', value: '180 nM (False Hit)', tone: 'amber' },
      { label: 'With 0.01% Triton X-100', value: '> 50,000 nM (Total Collapse)', tone: 'red' },
      { label: 'Replicate Noise / Hill Slope', value: 'CV 68%  |  Hill Slope 3.4', tone: 'red' },
    ],
    question:
      'Your screening dashboard still tags A-14 as an "Active Hit" for the XGBoost training set. What is your call?',
    choices: [
      {
        id: 'flag-pains-purge',
        label: 'Purge A-14 as a Colloidal Aggregator Artifact & Retest Orthogonal Assay',
        detail: 'Prevent assay noise from poisoning both chemistry and ML training labels',
        isSafeScientific: true,
        outcomeTitle: 'ASSAY INTEGRITY RESTORED — FALSE POSITIVE PURGED',
        outcomeText:
          'Sharp catch. Colloidal aggregators and PAINS (Pan-Assay Interference Compounds) waste millions and poison machine learning datasets with false "Active" labels. Counter-screening with detergent saves months of doomed synthesis.',
      },
      {
        id: 'keep-training-label',
        label: 'Keep the 180 nM Reading in the ML Training Database',
        detail: 'More "Active" labels make the pitch deck look richer',
        isSafeScientific: false,
        outcomeTitle: 'PIPELINE CORRUPTION — MODEL POISONED BY NOISE',
        outcomeText:
          'Disaster. Feeding noisy aggregation artifacts into XGBoost teaches the AI to hunt for sticky, useless false positives—trapping the entire lab in a loop of dead-end chemistry.',
      },
    ],
  },
  {
    id: 'exp-mutation-escape',
    podCode: 'POD-V14 // MUTATION DRIFT',
    title: 'Failed Culture V-14 — T790M Resistance Mutation',
    riskCategory: 'MUTATION ESCAPE',
    smellCue: 'Sickly sweet bio-broth & ruptured sterilant chlorine fumes',
    statusTag: 'PRESSURE WARNING · BIO-GROWTH',
    briefing: [
      'Scratched warning notes cling to the fogged cylinder: "IT ADAPTED IN 72 HOURS." Inside the sickly green nutrient suspension, dense mutated cell colonies thrive directly inside a lethal concentration of first-generation inhibitor.',
      'Sequencing revealed a single-point gatekeeper mutation (EGFR T790M) that sterically blocks the drug from entering the ATP pocket—a classic nightmare shared by both oncology targets and fast-mutating pathogens.',
    ],
    telemetry: [
      { label: 'Wild-Type Target IC50', value: '24 nM (Initially Sensitive)', tone: 'cyan' },
      { label: 'Mutant T790M Strain IC50', value: '9,400 nM (390x Loss of Potency)', tone: 'red' },
      { label: 'Containment Bio-Pressure', value: 'RISING · MUTANT DOMINANCE', tone: 'amber' },
    ],
    question:
      'The first-generation inhibitor has collapsed against the mutant strain. How do you respond?',
    choices: [
      {
        id: 'design-mutant-selective',
        label: 'Seal Tank & Pivot to Next-Gen Mutant-Selective Binding Strategy',
        detail: 'Screen against the T790M mutant assay directly & monitor resistance pathways',
        isSafeScientific: true,
        outcomeTitle: 'CONTAINMENT SEALED — RESISTANCE COUNTER-STRATEGY LOGGED',
        outcomeText:
          'Scientifically sound. Pathogens and tumor kinases evolve relentlessly under drug pressure. Real drug discovery anticipates resistance mutations early by testing mutant panels alongside wild-type targets.',
      },
      {
        id: 'megadose-old-drug',
        label: 'Simply Escalate Dose 400x to Force the Old Drug Through',
        detail: 'Ignore toxicity ceilings and flood the system',
        isSafeScientific: false,
        outcomeTitle: 'TOXIC OVERDOSE — THERAPEUTIC WINDOW DESTROYED',
        outcomeText:
          'Fatal error. Multiplying a dose 400-fold obliterates the therapeutic window, triggering severe systemic organ toxicity long before achieving effective inhibition of the resistant mutant.',
      },
    ],
  },
  {
    id: 'exp-trial-collapse',
    podCode: 'POD-B09 // PHASE II POST-MORTEM',
    title: 'Archived Collapse BQ-409 — Funding & Trial Failure',
    riskCategory: 'TRIAL & FUNDING COLLAPSE',
    smellCue: 'Burnt server insulation & sour degraded organic solvent',
    statusTag: 'LOCKED AUDIT · $340M LOSS',
    briefing: [
      'Smudged fingerprints cover the emergency purge keypad. A shredded Phase II readout floats inside the depressurized sample vault: "PRIMARY ENDPOINT MISSED — HEPATOTOXICITY SIGNAL IN COHORT B."',
      'Fourteen months ago, executives ignored early reactive-metabolite alerts and high LogP (6.8) to chase a $340M milestone. When the trial collapsed, Series C funding evaporated overnight—driving someone to deploy the rogue EXT-SYNC-09 script tonight.',
    ],
    telemetry: [
      { label: 'Trial Stage Collapse', value: 'Phase II Terminated (Liver Toxicity)', tone: 'red' },
      { label: 'Cash Runway Remaining', value: '19 Days Before Facility Foreclosure', tone: 'amber' },
      { label: 'Root Chemical Flaw', value: 'LogP 6.8 · Unchecked Reactive Metabolite', tone: 'red' },
    ],
    question:
      'An anonymous executive message flashes on the terminal: "Hide the metabolite appendix and publish the optimistic AI score so the bridge loan clears." Your decision?',
    choices: [
      {
        id: 'refuse-preserve-truth',
        label: 'Lock the Honest Failure Record & Enforce Transparent Go/No-Go Criteria',
        detail: 'Kill flawed candidates early ("fail fast, fail cheap") rather than in patients',
        isSafeScientific: true,
        outcomeTitle: 'ETHICAL PROTOCOL UPHELD — REAL SCIENCE PRESERVED',
        outcomeText:
          'The hardest lesson in medicinal chemistry: killing a bad molecule early hurts the quarterly budget, but hiding toxicity destroys patients, careers, and entire institutions. Transparent data is the only path to real medicine.',
      },
      {
        id: 'bury-metabolite-report',
        label: 'Suppress the Liver Toxicity Appendix to Secure Emergency Funding',
        detail: 'Sign off on the altered summary and hope Phase III gets lucky',
        isSafeScientific: false,
        outcomeTitle: 'CATASTROPHIC BREACH — SAFEGUARD ALARM TRIGGERED',
        outcomeText:
          'This exact shortcut caused the Blackout Protocol. Hiding preclinical toxicity guarantees clinical harm, criminal liability, and permanent collapse of scientific trust.',
      },
    ],
  },
];

export function getVaultById(id: number): VaultDefinition | undefined {
  return VAULTS.find((v) => v.id === id);
}

export function getLogById(id: string): StoryLogEntry | undefined {
  const atrium = ATRIUM_INCIDENT_LOGS.find((l) => l.id === id);
  if (atrium) return atrium;
  return VAULTS.find((v) => v.storyLog.id === id)?.storyLog;
}

export function getExperimentById(id: string): ExperimentDilemma | undefined {
  return FAILED_EXPERIMENTS.find((e) => e.id === id);
}

