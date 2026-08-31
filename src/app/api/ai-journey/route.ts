import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithFallback } from '@/lib/aiClient';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' });

// Every monetary value across this engine is expressed in INR (Indian Rupees).
const INR_RULE = `IMPORTANT CURRENCY RULE: ALL monetary values MUST be in INR (Indian Rupees) as plain integer rupee numbers (no $ sign, no commas, no "USD"). Convert any USD figures using 1 USD = 83 INR. Example: $40,000 => 3320000. For string cost fields use Indian formatting like "₹35–60 Lakhs".`;

const STYLE_RULE = `WRITING STYLE: Write a brief lead paragraph (2 sentences) followed by tight bullet points. Wrap the most important keywords/numbers in **double asterisks** so they render as bold (e.g. "**CGPA 8.34**"). Quote exact profile values wherever relevant. Be concise, sharp, and actionable — no filler.`;

export async function POST(request: Request) {
  try {
    const { phase, profileData, decisionState } = await request.json();

    let prompt = '';
    let responseSchema: any = null;

    switch (phase) {
      case 'PHASE_1_PROFILE':
        prompt = `You are an expert AI Study Abroad Consultant for Indian students. Analyze this profile and calculate an Academic Score (0-100), Financial Score (0-100), and Admission Readiness Score (0-100). 
Return a 1-line "summary", then 3-4 crisp bullet points each for academics, financials and admission readiness. ${STYLE_RULE} ${INR_RULE}
Profile: ${JSON.stringify(profileData)}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            academicScore: { type: Type.NUMBER },
            financialScore: { type: Type.NUMBER },
            admissionReadinessScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            academicPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            financialPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            admissionPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        };
        break;

      case 'PHASE_2_COUNTRY':
        prompt = `Recommend 3 best-fit countries for this Indian student. For each: matchScore (0-100), expectedCost (INR string like "₹35–60 Lakhs"), postStudyWork, jobMarket (0-100), visaDifficulty, plus "whyRecommended" (3 short bullet points) and "considerations" (2-3 short bullet points). Explicitly use CGPA and GRE/IELTS. ${STYLE_RULE} ${INR_RULE}
Profile: ${JSON.stringify(profileData)}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            recommendedCountries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  countryName: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER },
                  whyRecommended: { type: Type.ARRAY, items: { type: Type.STRING } },
                  considerations: { type: Type.ARRAY, items: { type: Type.STRING } },
                  expectedCost: { type: Type.STRING },
                  postStudyWork: { type: Type.STRING },
                  jobMarket: { type: Type.NUMBER },
                  visaDifficulty: { type: Type.STRING }
                }
              }
            }
          }
        };
        break;

      case 'PHASE_3_UNIVERSITY':
        prompt = `Recommend 3 best-match universities in ${decisionState?.selectedCountry || 'the recommended country'} for this profile. For each provide admissionChance (0-100), ranking, tuition (INR/year), livingCost (INR/year), roi (0-100), scholarshipAvailability, and "whyRecommended" as 3 short bullet points referencing their scores. ${STYLE_RULE} ${INR_RULE}
Profile: ${JSON.stringify(profileData)}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            bestMatchUniversities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  country: { type: Type.STRING },
                  admissionChance: { type: Type.NUMBER },
                  ranking: { type: Type.NUMBER },
                  tuition: { type: Type.NUMBER },
                  livingCost: { type: Type.NUMBER },
                  roi: { type: Type.NUMBER },
                  scholarshipAvailability: { type: Type.STRING },
                  whyRecommended: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        };
        break;

      case 'PHASE_4_ADMISSION':
        prompt = `Analyze admission chances for ${decisionState?.selectedUniversity || 'the selected university'} based on the profile. Provide currentChance (0-100), improvedChanceAfterRecs (0-100), "breakdownPoints" (3-4 short bullets explaining the chance), positiveFactors, negativeFactors and missingRequirements (each a list of short items). ${STYLE_RULE} ${INR_RULE}
Profile: ${JSON.stringify(profileData)}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            currentChance: { type: Type.NUMBER },
            breakdownPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            positiveFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
            negativeFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvedChanceAfterRecs: { type: Type.NUMBER }
          }
        };
        break;

      case 'PHASE_5_COST':
        prompt = `Calculate the total cost (in INR) for studying at ${decisionState?.selectedUniversity || 'the university'} in ${decisionState?.selectedCountry || 'the country'} for the full program. Break down tuition, living, insurance, visa, travel, miscellaneous, plus totalCost, yearlyCost and monthlyCost. ${INR_RULE}
Profile: ${JSON.stringify(profileData)}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            tuition: { type: Type.NUMBER },
            living: { type: Type.NUMBER },
            insurance: { type: Type.NUMBER },
            visa: { type: Type.NUMBER },
            travel: { type: Type.NUMBER },
            miscellaneous: { type: Type.NUMBER },
            totalCost: { type: Type.NUMBER },
            yearlyCost: { type: Type.NUMBER },
            monthlyCost: { type: Type.NUMBER }
          }
        };
        break;

      case 'PHASE_6_AFFORDABILITY':
        prompt = `Analyze affordability in INR. Student budget: ${profileData?.expectedBudgetStr || profileData?.budgetLakhs + ' Lakhs'}. Total course cost (INR): ${decisionState?.totalCost?.totalCost || 5000000}. Return canAfford (boolean), fundingGap, selfFundingCapacity, savingsContribution, familyContribution (all INR), and "reasoningPoints" (3 short bullets). ${INR_RULE}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            canAfford: { type: Type.BOOLEAN },
            fundingGap: { type: Type.NUMBER },
            selfFundingCapacity: { type: Type.NUMBER },
            savingsContribution: { type: Type.NUMBER },
            familyContribution: { type: Type.NUMBER },
            reasoningPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        };
        break;

      case 'PHASE_7_LOAN':
        prompt = `Generate an education-loan plan (all INR) for a funding gap of ${decisionState?.affordability?.fundingGap || 2000000}. Provide loanAmountRequired (INR), emi (monthly INR), interest (annual %), recommendedLenders (Indian NBFCs/banks like HDFC Credila, Avanse, Auxilo, SBI), and "notes" (2-3 short bullets on tenure/collateral/moratorium). ${INR_RULE}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            loanAmountRequired: { type: Type.NUMBER },
            emi: { type: Type.NUMBER },
            interest: { type: Type.NUMBER },
            recommendedLenders: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        };
        break;

      case 'PHASE_8_DOCUMENTS':
        prompt = `Determine required documents for applying to ${decisionState?.selectedUniversity || 'a top university'}. Classify into available, missing and pending based on profile. ${STYLE_RULE}
Profile: ${JSON.stringify(profileData)}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            requiredDocuments: { type: Type.ARRAY, items: { type: Type.STRING } },
            available: { type: Type.ARRAY, items: { type: Type.STRING } },
            missing: { type: Type.ARRAY, items: { type: Type.STRING } },
            pending: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        };
        break;

      case 'PHASE_9_DOC_ACQUISITION':
        prompt = `Provide a clear step-by-step acquisition guide for these missing documents: ${decisionState?.documentReadiness?.missing?.join(', ') || 'Passport, Transcripts'}. Keep each step short and actionable. ${STYLE_RULE}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            guides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  documentName: { type: Type.STRING },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        };
        break;

      case 'PHASE_10_REVIEWS':
        let reviewContext = "No live reviews found.";
        const universityName = decisionState?.selectedUniversity || "the university";

        // Use Serper API for live grounding
        try {
          if (process.env.SERPER_API_KEY) {
            const queries = [`${universityName} student reviews reddit`, `${universityName} international students placements`];
            const serperResponses = await Promise.all(queries.map(q =>
              fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': process.env.SERPER_API_KEY || '', 'Content-Type': 'application/json' },
                body: JSON.stringify({ q })
              }).then(res => res.json())
            ));

            reviewContext = serperResponses.map(res =>
              (res.organic || []).slice(0, 3).map((r: any) => r.snippet).join('\n')
            ).join('\n\n');
          }
        } catch (e) {
          console.error("Serper API error", e);
        }

        prompt = `Summarize these live reviews and placement data for ${universityName}. Live Data: ${reviewContext}\n\nGenerate pros, cons (short bullets), placementInsights, housingInsights, studentSatisfaction, and a sentimentScore (0-100). Mention salaries in INR if relevant. ${INR_RULE}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
            cons: { type: Type.ARRAY, items: { type: Type.STRING } },
            placementInsights: { type: Type.STRING },
            housingInsights: { type: Type.STRING },
            studentSatisfaction: { type: Type.STRING },
            sentimentScore: { type: Type.NUMBER }
          }
        };
        break;

      case 'PHASE_11_ROADMAP':
        prompt = `Generate a prioritized 90-day action roadmap for applying to ${decisionState?.selectedUniversity || 'the university'} in ${decisionState?.selectedCountry}. Missing docs: ${decisionState?.documentReadiness?.missing?.join(',')}. Funding Gap (INR): ${decisionState?.affordability?.fundingGap}. Each item must be a short, concrete action. Prioritize admission risk and funding. ${STYLE_RULE}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            immediateActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            day7Plan: { type: Type.ARRAY, items: { type: Type.STRING } },
            day30Plan: { type: Type.ARRAY, items: { type: Type.STRING } },
            day60Plan: { type: Type.ARRAY, items: { type: Type.STRING } },
            day90Plan: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });
    }

    try {
      if (process.env.GEMINI_API_KEY === 'mock' || !process.env.GEMINI_API_KEY) {
        throw new Error('No API key');
      }
      const response = await generateContentWithFallback(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.2,
        }
      });
      const text = response.text;
      if (!text) throw new Error('Empty response from AI');
      return NextResponse.json({ data: JSON.parse(text) });
    } catch (apiError) {
      console.warn('Falling back to mock data due to AI error:', apiError);
      return NextResponse.json({ data: generateMockData(phase) });
    }
  } catch (error: any) {
    console.error('AI Journey Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// All monetary values in mock data are in INR.
function generateMockData(phase: string) {
  switch (phase) {
    case 'PHASE_1_PROFILE':
      return {
        academicScore: 78, financialScore: 65, admissionReadinessScore: 60,
        summary: "Strong academics, but financing and test-readiness need attention before applying.",
        academicPoints: [
          "Excellent undergraduate CGPA — a major strength for admissions.",
          "GRE/English test scores still need to be improved or completed.",
          "Relevant degree aligned with your target field.",
          "Limited research output; internships add some weight."
        ],
        financialPoints: [
          "Stated budget is below typical program cost — a funding gap is likely.",
          "Co-applicant income supports loan eligibility.",
          "Collateral availability will influence your interest rate."
        ],
        admissionPoints: [
          "You are in an early 'exploring' stage.",
          "SOP and LORs are still pending.",
          "No universities finalized yet — shortlist soon to stay on timeline."
        ]
      };
    case 'PHASE_2_COUNTRY':
      return {
        recommendedCountries: [
          { countryName: 'Germany', matchScore: 80, whyRecommended: ["Low/zero tuition at public universities", "Strong STEM job market", "Budget-friendly within ₹15–25L"], considerations: ["English test still required", "Learning German boosts job prospects"], expectedCost: '₹15–25 Lakhs', postStudyWork: '18 months', jobMarket: 85, visaDifficulty: 'Moderate' },
          { countryName: 'Canada', matchScore: 72, whyRecommended: ["Excellent post-study work (PGWP)", "High-quality programs", "Clear PR pathway"], considerations: ["IELTS mandatory", "Total cost higher than Germany"], expectedCost: '₹35–60 Lakhs', postStudyWork: '3 years', jobMarket: 80, visaDifficulty: 'Moderate' },
          { countryName: 'Ireland', matchScore: 66, whyRecommended: ["Fast-growing tech hub", "2-year stay-back visa", "Many MNCs hiring"], considerations: ["IELTS required", "Cost at upper end of budget"], expectedCost: '₹30–50 Lakhs', postStudyWork: '2 years', jobMarket: 75, visaDifficulty: 'Moderate' }
        ]
      };
    case 'PHASE_3_UNIVERSITY':
      return {
        bestMatchUniversities: [
          { id: '1', name: 'University of Alberta', country: 'Canada', admissionChance: 65, ranking: 111, tuition: 912000, livingCost: 1245000, roi: 88, scholarshipAvailability: 'Medium', whyRecommended: ["World-class CS/AI department", "Often no GRE required", "Lower living cost than big cities"] },
          { id: '2', name: 'Simon Fraser University', country: 'Canada', admissionChance: 60, ranking: 318, tuition: 2075000, livingCost: 1245000, roi: 82, scholarshipAvailability: 'Medium', whyRecommended: ["Strong industry ties in Vancouver", "GRE recommended, not required", "Great for placements"] },
          { id: '3', name: 'Western University', country: 'Canada', admissionChance: 70, ranking: 172, tuition: 2656000, livingCost: 1162000, roi: 80, scholarshipAvailability: 'Low', whyRecommended: ["Career-focused Data Science program", "Strong Ontario industry network", "GRE often waived"] }
        ]
      };
    case 'PHASE_4_ADMISSION':
      return {
        currentChance: 35, improvedChanceAfterRecs: 70,
        breakdownPoints: [
          "Strong CGPA lifts your baseline chance.",
          "Missing English proficiency test is the biggest blocker.",
          "Completing SOP + LORs would meaningfully raise your odds."
        ],
        positiveFactors: ["Excellent CGPA", "Relevant degree", "Internship experience", "No backlogs"],
        negativeFactors: ["Low/!pending standardized test", "No research papers"],
        missingRequirements: ["IELTS/TOEFL score", "Final SOP", "2-3 LORs"]
      };
    case 'PHASE_5_COST':
      return { tuition: 2075000, living: 1245000, insurance: 83000, visa: 41500, travel: 83000, miscellaneous: 166000, totalCost: 3693500, yearlyCost: 1846750, monthlyCost: 153900 };
    case 'PHASE_6_AFFORDABILITY':
      return {
        canAfford: false, fundingGap: 1660000, selfFundingCapacity: 830000, savingsContribution: 415000, familyContribution: 415000,
        reasoningPoints: [
          "Your budget covers part of the total cost.",
          "A funding gap of about ₹16.6L remains.",
          "An education loan with a co-applicant can bridge this."
        ]
      };
    case 'PHASE_7_LOAN':
      return { loanAmountRequired: 1660000, emi: 21500, interest: 10.5, recommendedLenders: ["HDFC Credila", "Avanse", "Auxilo", "SBI"], notes: ["10-year tenure keeps EMI manageable", "Collateral lowers your rate by 2-3%", "Moratorium covers course + 6 months"] };
    case 'PHASE_8_DOCUMENTS':
      return { requiredDocuments: ["Passport", "Transcripts", "SOP", "LOR", "Resume/CV", "IELTS/TOEFL", "Bank Statements"], available: ["Passport", "Transcripts", "Bank Statements"], missing: ["IELTS/TOEFL", "SOP"], pending: ["LOR", "Resume/CV"] };
    case 'PHASE_9_DOC_ACQUISITION':
      return { guides: [{ documentName: "IELTS/TOEFL", steps: ["Pick the accepted test & target score", "Register for the earliest slot", "Prepare with official material", "Take the test", "Send official scores to universities"] }, { documentName: "SOP", steps: ["Outline your goals & fit", "Draft 1-2 pages", "Get it reviewed", "Finalize & proofread"] }] };
    case 'PHASE_10_REVIEWS':
      return { pros: ["Great professors", "Strong CS reputation", "Good scholarship availability"], cons: ["High cost of living", "Cold winters", "Quiet campus social life initially"], placementInsights: "Strong tech placements; average starting salary around ₹70–85L/year for top grads.", housingInsights: "Apply for housing early; on-campus options fill fast.", studentSatisfaction: "High", sentimentScore: 78 };
    case 'PHASE_11_ROADMAP':
      return { immediateActions: ["Register for IELTS/TOEFL", "Start your SOP draft", "Shortlist 5 universities"], day7Plan: ["Finalize SOP outline", "Request LORs from 2 recommenders", "Order official transcripts"], day30Plan: ["Take IELTS/TOEFL", "Complete SOP", "Begin loan pre-approval"], day60Plan: ["Submit applications", "Compare loan offers", "Prepare financial documents"], day90Plan: ["Track decisions", "Accept best offer", "Start visa preparation"] };
    default:
      return {};
  }
}
