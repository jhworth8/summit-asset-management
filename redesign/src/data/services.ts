export type ServiceStage = {
  number: string;
  title: string;
  subtitle?: string;
  summary: string;
  bullets: string[];
};

export type AssetClassItem = {
  title: string;
  category: string;
  description: string;
  instruments: string[];
};

export type PlanningAreaItem = {
  title: string;
  tagline: string;
  description: string;
};

export const serviceOverview = {
  investment: {
    label: 'Investment management',
    title: 'A portfolio built from the client outward.',
    body: 'Client goals, collaborative research, personalized construction and continuing oversight shape the investment work.',
    points: ['Goals and risk', 'Portfolio construction', 'Continuing oversight'],
    href: '/services/investment-management',
  },
  summit: {
    label: 'The Summit approach',
    title: 'The plan and the portfolio inform one another.',
    body: 'Organizing the complete financial picture clarifies what assets are for—and how they should be invested.',
    points: ['One client view', 'Coordinated decisions', 'Long-term continuity'],
    href: '/services',
  },
  planning: {
    label: 'Financial planning',
    title: 'Advice that connects decisions over time.',
    body: 'Summit takes a comprehensive view, outlines concrete actions, coordinates with other professionals and keeps the plan connected.',
    points: ['Comprehensive', 'Concrete', 'Coordinated and connected'],
    href: '/services/financial-planning',
  },
};

export const investmentStages: ServiceStage[] = [
  {
    number: '01',
    title: 'Client Goals',
    subtitle: 'Discovery & Profile Assessment',
    summary: 'For each client, we begin the investment process by identifying an appropriate asset allocation tailored to their distinct objectives.',
    bullets: [
      'Time horizon & long-term financial milestones',
      'Tolerance for risk & market volatility',
      'Income generation requirements & liquidity needs',
      'Tax sensitivity & specific tax bracket considerations',
      'Unique family, personal, and charitable life goals',
    ],
  },
  {
    number: '02',
    title: 'Collaboration',
    subtitle: 'Firm-Wide Committee & Advisor Guidance',
    summary: 'We take a team approach to bring our best investment ideas, collective knowledge, and institutional discipline to every client portfolio.',
    bullets: [
      'Investment Committee provides oversight, discipline, and macroeconomic direction',
      'Individual advisors tailor accounts to the precise circumstances of each client',
      'Firm-wide synergy ensures the optimal balance of investment strategy and personal service',
    ],
  },
  {
    number: '03',
    title: 'Portfolio Construction',
    subtitle: 'Diversification Across Asset Classes',
    summary: 'We build diversified client portfolios using an extensive range of asset classes and carefully evaluated investment vehicles.',
    bullets: [
      'Exchange-Traded Funds (ETFs) & institutional Mutual Funds',
      'Individual securities including Equities (Stocks), Fixed Income (Bonds), and CDs',
      'Selective Alternative investments, Hedge Funds of Funds, and Private Partnerships',
      'Disciplined asset allocation customized to target risk and return profiles',
    ],
  },
  {
    number: '04',
    title: 'Continuity & Oversight',
    subtitle: 'Ongoing Monitoring & Proactive Adjustment',
    summary: 'We continually evaluate portfolios, positions, and targets—adjusting the asset mix over time as markets evolve and client lives change.',
    bullets: [
      'Continuous evaluation of portfolio weightings and underlying holdings',
      'Disciplined rebalancing with keen attention to transaction costs and tax impact',
      'Proactive modifications to discretionary accounts as opportunities and needs develop',
    ],
  },
];

export const assetClasses: AssetClassItem[] = [
  {
    title: 'Equities & Stocks',
    category: 'Growth & Capital Appreciation',
    description: 'Domestic and international equities selected for long-term growth, dividend sustainability, and sector diversification.',
    instruments: ['Large, Mid & Small Cap Equities', 'International & Emerging Markets', 'Dividend Growth Leaders'],
  },
  {
    title: 'Fixed Income & Bonds',
    category: 'Capital Preservation & Income',
    description: 'High-quality debt instruments and cash equivalents designed to generate reliable income and moderate portfolio volatility.',
    instruments: ['U.S. Treasuries & Agencies', 'Municipal & Corporate Bonds', 'Certificates of Deposit (CDs)'],
  },
  {
    title: 'Mutual Funds & ETFs',
    category: 'Institutional Market Exposure',
    description: 'Low-cost, liquid vehicles offering targeted exposure across broad asset classes, specialized sectors, and global indices.',
    instruments: ['Index & Factor-Based ETFs', 'Active Institutional Mutual Funds', 'Thematic & Specialty Allocations'],
  },
  {
    title: 'Alternative Strategies',
    category: 'Uncorrelated Diversification',
    description: 'Select investments designed to provide returns that have lower correlation to traditional equity and debt markets.',
    instruments: ['Private Partnerships', 'Hedge Funds of Funds', 'Hedging & Option Strategies'],
  },
];

export const planningStages: ServiceStage[] = [
  {
    number: '01',
    title: 'Comprehensive',
    subtitle: 'The Whole Picture in Context',
    summary: 'We provide unbiased advice on a broad spectrum of financial issues, helping clients see both the bigger picture and the intricate details in context.',
    bullets: [
      'Holistic evaluation across retirement, taxes, estate, and insurance',
      'Identification of blind spots and intersecting financial liabilities',
      'Contextual modeling for major life events and transitions',
    ],
  },
  {
    number: '02',
    title: 'Concrete',
    subtitle: 'From Concepts to Action Steps',
    summary: 'We help clients move from abstract concepts to concrete action, prioritizing items that require immediate attention and suggesting actionable solutions.',
    bullets: [
      'Prioritized, step-by-step implementation roadmaps',
      'Objective, quantitative recommendations and trade-off analysis',
      'Continuous monitoring of milestones and measured progress',
    ],
  },
  {
    number: '03',
    title: 'Coordinated',
    subtitle: 'Orchestrating Your Advisory Team',
    summary: 'We work directly with your legal counsel, CPAs, trustees, and other professionals to ensure all aspects of your financial plan are fully aligned.',
    bullets: [
      'Collaborative alignment with CPAs on tax minimization strategies',
      'Integration with estate attorneys on trust and legacy structures',
      'Mediation and orchestration among family members and business partners',
    ],
  },
  {
    number: '04',
    title: 'Connected',
    subtitle: 'Enduring Continuity Across Generations',
    summary: 'We provide long-term continuity for spouses, beneficiaries, and future generations—serving as an enduring repository of client history and wisdom.',
    bullets: [
      'Seamless fiduciary transitions for trusts and custodial accounts',
      'Guidance for successor trustees, family heirs, and nonprofit boards',
      'Preservation of client history and institutional memory across decades',
    ],
  },
];

export const planningAreas: PlanningAreaItem[] = [
  {
    title: 'Retirement Planning',
    tagline: 'Securing lifestyle & cash flow continuity',
    description: 'Developing sustainable distribution strategies, Social Security optimization, pension analysis, and long-term cash flow modeling.',
  },
  {
    title: 'Tax Strategy & Mitigation',
    tagline: 'Keeping more of what you earn',
    description: 'Working alongside your CPA to optimize asset location, tax-loss harvesting, Roth conversion strategies, and charitable deductions.',
  },
  {
    title: 'Estate & Trust Planning',
    tagline: 'Protecting and transferring wealth',
    description: 'Structuring wills, trusts, powers of attorney, and healthcare directives in harmony with your family values and legacy wishes.',
  },
  {
    title: 'Insurance & Risk Management',
    tagline: 'Shielding against the unexpected',
    description: 'Objective analysis of life, disability, long-term care, and liability coverage to ensure adequate protection without excess costs.',
  },
  {
    title: 'Education Funding',
    tagline: 'Investing in the next generation',
    description: 'Designing tax-advantaged 529 savings plans, custodial accounts, and educational trusts for children and grandchildren.',
  },
  {
    title: 'Charitable & Philanthropic Giving',
    tagline: 'Maximizing your community impact',
    description: 'Implementing donor-advised funds, charitable remainder trusts, and direct gifting of appreciated securities for maximum tax efficiency.',
  },
  {
    title: 'Business Succession & Transitions',
    tagline: 'Guiding entrepreneurs and owners',
    description: 'Planning for business valuation, buy-sell agreements, ownership transfer, key-person protection, and liquidity events.',
  },
  {
    title: 'Family Partnerships & Governance',
    tagline: 'Multi-generational harmony',
    description: 'Facilitating family financial meetings, educating rising generations, and structuring shared entity assets for enduring stewardship.',
  },
];
