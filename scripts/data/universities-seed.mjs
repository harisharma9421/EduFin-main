// Hand-curated university seed list. T1 = top tier (lowest acceptance, highest
// cutoffs, widest course catalog). T2 = strong mid-tier. T3 = accessible.
// The generator below cross-multiplies these with the COURSES catalog to
// produce 10K+ realistic university-course rows.

export const UNIVERSITIES = {
  USA: {
    T1: [
      { name: 'Massachusetts Institute of Technology', short: 'MIT', city: 'Cambridge', state: 'Massachusetts', qs: 1, the: 2 },
      { name: 'Stanford University', short: 'Stanford', city: 'Stanford', state: 'California', qs: 5, the: 4 },
      { name: 'Harvard University', short: 'Harvard', city: 'Cambridge', state: 'Massachusetts', qs: 4, the: 3 },
      { name: 'California Institute of Technology', short: 'Caltech', city: 'Pasadena', state: 'California', qs: 10, the: 7 },
      { name: 'Princeton University', short: 'Princeton', city: 'Princeton', state: 'New Jersey', qs: 17, the: 6 },
      { name: 'Yale University', short: 'Yale', city: 'New Haven', state: 'Connecticut', qs: 16, the: 9 },
      { name: 'University of California, Berkeley', short: 'UC Berkeley', city: 'Berkeley', state: 'California', qs: 12, the: 8 },
      { name: 'Carnegie Mellon University', short: 'CMU', city: 'Pittsburgh', state: 'Pennsylvania', qs: 58, the: 26 },
      { name: 'Columbia University', short: 'Columbia', city: 'New York', state: 'New York', qs: 23, the: 17 },
      { name: 'University of Chicago', short: 'UChicago', city: 'Chicago', state: 'Illinois', qs: 21, the: 14 },
    ],
    T2: [
      { name: 'University of California, Los Angeles', short: 'UCLA', city: 'Los Angeles', state: 'California', qs: 42, the: 18 },
      { name: 'University of Michigan', short: 'UMich', city: 'Ann Arbor', state: 'Michigan', qs: 44, the: 23 },
      { name: 'Cornell University', short: 'Cornell', city: 'Ithaca', state: 'New York', qs: 16, the: 22 },
      { name: 'University of Pennsylvania', short: 'UPenn', city: 'Philadelphia', state: 'Pennsylvania', qs: 11, the: 16 },
      { name: 'Duke University', short: 'Duke', city: 'Durham', state: 'North Carolina', qs: 50, the: 25 },
      { name: 'Northwestern University', short: 'Northwestern', city: 'Evanston', state: 'Illinois', qs: 50, the: 28 },
      { name: 'Johns Hopkins University', short: 'JHU', city: 'Baltimore', state: 'Maryland', qs: 28, the: 15 },
      { name: 'New York University', short: 'NYU', city: 'New York', state: 'New York', qs: 38, the: 24 },
      { name: 'University of Washington', short: 'UW', city: 'Seattle', state: 'Washington', qs: 63, the: 26 },
      { name: 'Georgia Institute of Technology', short: 'Georgia Tech', city: 'Atlanta', state: 'Georgia', qs: 97, the: 38 },
      { name: 'University of Texas at Austin', short: 'UT Austin', city: 'Austin', state: 'Texas', qs: 65, the: 49 },
      { name: 'University of Illinois Urbana-Champaign', short: 'UIUC', city: 'Champaign', state: 'Illinois', qs: 69, the: 51 },
      { name: 'University of Wisconsin-Madison', short: 'UW Madison', city: 'Madison', state: 'Wisconsin', qs: 87, the: 76 },
      { name: 'Purdue University', short: 'Purdue', city: 'West Lafayette', state: 'Indiana', qs: 99, the: 86 },
      { name: 'Brown University', short: 'Brown', city: 'Providence', state: 'Rhode Island', qs: 64, the: 64 },
    ],
    T3: [
      { name: 'University of California, San Diego', short: 'UCSD', city: 'La Jolla', state: 'California', qs: 72, the: 32 },
      { name: 'University of Maryland, College Park', short: 'UMD', city: 'College Park', state: 'Maryland', qs: 110, the: 80 },
      { name: 'Pennsylvania State University', short: 'Penn State', city: 'University Park', state: 'Pennsylvania', qs: 92, the: 90 },
      { name: 'Boston University', short: 'BU', city: 'Boston', state: 'Massachusetts', qs: 108, the: 70 },
      { name: 'Texas A&M University', short: 'TAMU', city: 'College Station', state: 'Texas', qs: 154, the: 165 },
      { name: 'North Carolina State University', short: 'NC State', city: 'Raleigh', state: 'North Carolina', qs: 339, the: 251 },
      { name: 'Arizona State University', short: 'ASU', city: 'Tempe', state: 'Arizona', qs: 187, the: 184 },
      { name: 'Northeastern University', short: 'Northeastern', city: 'Boston', state: 'Massachusetts', qs: 169, the: 167 },
      { name: 'University of Southern California', short: 'USC', city: 'Los Angeles', state: 'California', qs: 116, the: 67 },
      { name: 'Stony Brook University', short: 'Stony Brook', city: 'Stony Brook', state: 'New York', qs: 373, the: 401 },
      { name: 'Rutgers University', short: 'Rutgers', city: 'New Brunswick', state: 'New Jersey', qs: 290, the: 130 },
      { name: 'Indiana University Bloomington', short: 'IUB', city: 'Bloomington', state: 'Indiana', qs: 257, the: 138 },
      { name: 'University of Florida', short: 'UF', city: 'Gainesville', state: 'Florida', qs: 168, the: 153 },
      { name: 'Iowa State University', short: 'Iowa State', city: 'Ames', state: 'Iowa', qs: 451, the: 401 },
      { name: 'University of Buffalo', short: 'UB', city: 'Buffalo', state: 'New York', qs: 338, the: 351 },
      { name: 'Syracuse University', short: 'Syracuse', city: 'Syracuse', state: 'New York', qs: 472, the: 401 },
      { name: 'University of Cincinnati', short: 'UC', city: 'Cincinnati', state: 'Ohio', qs: 661, the: 351 },
      { name: 'Drexel University', short: 'Drexel', city: 'Philadelphia', state: 'Pennsylvania', qs: 561, the: 401 },
      { name: 'New Jersey Institute of Technology', short: 'NJIT', city: 'Newark', state: 'New Jersey', qs: 951, the: 601 },
      { name: 'University of Houston', short: 'UH', city: 'Houston', state: 'Texas', qs: 591, the: 351 },
    ],
  },
  UK: {
    T1: [
      { name: 'University of Oxford', short: 'Oxford', city: 'Oxford', state: 'England', qs: 3, the: 1 },
      { name: 'University of Cambridge', short: 'Cambridge', city: 'Cambridge', state: 'England', qs: 2, the: 5 },
      { name: 'Imperial College London', short: 'Imperial', city: 'London', state: 'England', qs: 6, the: 8 },
      { name: 'University College London', short: 'UCL', city: 'London', state: 'England', qs: 9, the: 22 },
      { name: 'London School of Economics', short: 'LSE', city: 'London', state: 'England', qs: 50, the: 26 },
      { name: 'University of Edinburgh', short: 'Edinburgh', city: 'Edinburgh', state: 'Scotland', qs: 27, the: 30 },
      { name: 'King\'s College London', short: 'KCL', city: 'London', state: 'England', qs: 40, the: 38 },
    ],
    T2: [
      { name: 'University of Manchester', short: 'Manchester', city: 'Manchester', state: 'England', qs: 34, the: 53 },
      { name: 'University of Bristol', short: 'Bristol', city: 'Bristol', state: 'England', qs: 54, the: 81 },
      { name: 'University of Warwick', short: 'Warwick', city: 'Coventry', state: 'England', qs: 69, the: 106 },
      { name: 'University of Glasgow', short: 'Glasgow', city: 'Glasgow', state: 'Scotland', qs: 78, the: 87 },
      { name: 'University of Birmingham', short: 'Birmingham', city: 'Birmingham', state: 'England', qs: 80, the: 104 },
      { name: 'University of Southampton', short: 'Southampton', city: 'Southampton', state: 'England', qs: 81, the: 105 },
      { name: 'University of Leeds', short: 'Leeds', city: 'Leeds', state: 'England', qs: 82, the: 128 },
      { name: 'University of Sheffield', short: 'Sheffield', city: 'Sheffield', state: 'England', qs: 105, the: 105 },
      { name: 'University of Nottingham', short: 'Nottingham', city: 'Nottingham', state: 'England', qs: 108, the: 130 },
      { name: 'Queen Mary University of London', short: 'QMUL', city: 'London', state: 'England', qs: 138, the: 147 },
    ],
    T3: [
      { name: 'University of Liverpool', short: 'Liverpool', city: 'Liverpool', state: 'England', qs: 165, the: 178 },
      { name: 'Newcastle University', short: 'Newcastle', city: 'Newcastle', state: 'England', qs: 168, the: 168 },
      { name: 'Durham University', short: 'Durham', city: 'Durham', state: 'England', qs: 89, the: 173 },
      { name: 'Lancaster University', short: 'Lancaster', city: 'Lancaster', state: 'England', qs: 174, the: 134 },
      { name: 'University of York', short: 'York', city: 'York', state: 'England', qs: 171, the: 170 },
      { name: 'University of Reading', short: 'Reading', city: 'Reading', state: 'England', qs: 188, the: 191 },
      { name: 'Cardiff University', short: 'Cardiff', city: 'Cardiff', state: 'Wales', qs: 186, the: 191 },
      { name: 'University of Sussex', short: 'Sussex', city: 'Brighton', state: 'England', qs: 218, the: 178 },
      { name: 'Coventry University', short: 'Coventry', city: 'Coventry', state: 'England', qs: 526, the: 601 },
      { name: 'University of Strathclyde', short: 'Strathclyde', city: 'Glasgow', state: 'Scotland', qs: 296, the: 401 },
      { name: 'Aston University', short: 'Aston', city: 'Birmingham', state: 'England', qs: 421, the: 351 },
    ],
  },
  Canada: {
    T1: [
      { name: 'University of Toronto', short: 'UofT', city: 'Toronto', state: 'Ontario', qs: 25, the: 21 },
      { name: 'McGill University', short: 'McGill', city: 'Montreal', state: 'Quebec', qs: 29, the: 47 },
      { name: 'University of British Columbia', short: 'UBC', city: 'Vancouver', state: 'British Columbia', qs: 38, the: 41 },
      { name: 'University of Waterloo', short: 'Waterloo', city: 'Waterloo', state: 'Ontario', qs: 112, the: 158 },
    ],
    T2: [
      { name: 'McMaster University', short: 'McMaster', city: 'Hamilton', state: 'Ontario', qs: 189, the: 116 },
      { name: 'University of Alberta', short: 'UAlberta', city: 'Edmonton', state: 'Alberta', qs: 96, the: 109 },
      { name: 'Western University', short: 'Western', city: 'London', state: 'Ontario', qs: 114, the: 112 },
      { name: 'Queen\'s University', short: 'Queen\'s', city: 'Kingston', state: 'Ontario', qs: 209, the: 251 },
      { name: 'Simon Fraser University', short: 'SFU', city: 'Burnaby', state: 'British Columbia', qs: 318, the: 401 },
      { name: 'University of Calgary', short: 'UCalgary', city: 'Calgary', state: 'Alberta', qs: 174, the: 201 },
      { name: 'University of Ottawa', short: 'uOttawa', city: 'Ottawa', state: 'Ontario', qs: 203, the: 201 },
    ],
    T3: [
      { name: 'York University', short: 'York', city: 'Toronto', state: 'Ontario', qs: 353, the: 351 },
      { name: 'Concordia University', short: 'Concordia', city: 'Montreal', state: 'Quebec', qs: 601, the: 601 },
      { name: 'Carleton University', short: 'Carleton', city: 'Ottawa', state: 'Ontario', qs: 656, the: 501 },
      { name: 'University of Manitoba', short: 'UManitoba', city: 'Winnipeg', state: 'Manitoba', qs: 651, the: 601 },
      { name: 'Dalhousie University', short: 'Dalhousie', city: 'Halifax', state: 'Nova Scotia', qs: 298, the: 351 },
      { name: 'University of Saskatchewan', short: 'USask', city: 'Saskatoon', state: 'Saskatchewan', qs: 372, the: 401 },
      { name: 'University of Windsor', short: 'UWindsor', city: 'Windsor', state: 'Ontario', qs: 731, the: 601 },
      { name: 'Memorial University', short: 'MUN', city: 'St. John\'s', state: 'Newfoundland', qs: 731, the: 601 },
      { name: 'Lakehead University', short: 'Lakehead', city: 'Thunder Bay', state: 'Ontario', qs: 1001, the: 801 },
    ],
  },
  Australia: {
    T1: [
      { name: 'University of Melbourne', short: 'Melbourne', city: 'Melbourne', state: 'Victoria', qs: 13, the: 39 },
      { name: 'Australian National University', short: 'ANU', city: 'Canberra', state: 'ACT', qs: 30, the: 67 },
      { name: 'University of Sydney', short: 'USYD', city: 'Sydney', state: 'New South Wales', qs: 18, the: 60 },
      { name: 'University of New South Wales', short: 'UNSW', city: 'Sydney', state: 'New South Wales', qs: 19, the: 71 },
      { name: 'University of Queensland', short: 'UQ', city: 'Brisbane', state: 'Queensland', qs: 40, the: 70 },
      { name: 'Monash University', short: 'Monash', city: 'Melbourne', state: 'Victoria', qs: 37, the: 58 },
    ],
    T2: [
      { name: 'University of Western Australia', short: 'UWA', city: 'Perth', state: 'Western Australia', qs: 77, the: 149 },
      { name: 'University of Adelaide', short: 'Adelaide', city: 'Adelaide', state: 'South Australia', qs: 82, the: 128 },
      { name: 'University of Technology Sydney', short: 'UTS', city: 'Sydney', state: 'New South Wales', qs: 88, the: 154 },
      { name: 'Macquarie University', short: 'Macquarie', city: 'Sydney', state: 'New South Wales', qs: 113, the: 178 },
      { name: 'RMIT University', short: 'RMIT', city: 'Melbourne', state: 'Victoria', qs: 123, the: 251 },
      { name: 'Queensland University of Technology', short: 'QUT', city: 'Brisbane', state: 'Queensland', qs: 209, the: 201 },
    ],
    T3: [
      { name: 'University of Wollongong', short: 'UoW', city: 'Wollongong', state: 'New South Wales', qs: 167, the: 251 },
      { name: 'Curtin University', short: 'Curtin', city: 'Perth', state: 'Western Australia', qs: 174, the: 201 },
      { name: 'Deakin University', short: 'Deakin', city: 'Melbourne', state: 'Victoria', qs: 197, the: 201 },
      { name: 'La Trobe University', short: 'La Trobe', city: 'Melbourne', state: 'Victoria', qs: 217, the: 251 },
      { name: 'Griffith University', short: 'Griffith', city: 'Brisbane', state: 'Queensland', qs: 300, the: 301 },
      { name: 'University of Tasmania', short: 'UTAS', city: 'Hobart', state: 'Tasmania', qs: 303, the: 251 },
    ],
  },
  Germany: {
    T1: [
      { name: 'Technical University of Munich', short: 'TUM', city: 'Munich', state: 'Bavaria', qs: 28, the: 26 },
      { name: 'Ludwig Maximilian University', short: 'LMU', city: 'Munich', state: 'Bavaria', qs: 59, the: 38 },
      { name: 'Heidelberg University', short: 'Heidelberg', city: 'Heidelberg', state: 'Baden-Württemberg', qs: 84, the: 47 },
      { name: 'RWTH Aachen University', short: 'RWTH', city: 'Aachen', state: 'North Rhine-Westphalia', qs: 99, the: 99 },
    ],
    T2: [
      { name: 'Humboldt University of Berlin', short: 'HU Berlin', city: 'Berlin', state: 'Berlin', qs: 120, the: 86 },
      { name: 'Free University of Berlin', short: 'FU Berlin', city: 'Berlin', state: 'Berlin', qs: 98, the: 91 },
      { name: 'TU Berlin', short: 'TU Berlin', city: 'Berlin', state: 'Berlin', qs: 154, the: 119 },
      { name: 'University of Freiburg', short: 'Freiburg', city: 'Freiburg', state: 'Baden-Württemberg', qs: 192, the: 108 },
      { name: 'University of Tübingen', short: 'Tübingen', city: 'Tübingen', state: 'Baden-Württemberg', qs: 213, the: 95 },
      { name: 'KIT Karlsruhe', short: 'KIT', city: 'Karlsruhe', state: 'Baden-Württemberg', qs: 119, the: 251 },
      { name: 'TU Darmstadt', short: 'TU Darmstadt', city: 'Darmstadt', state: 'Hesse', qs: 232, the: 251 },
    ],
    T3: [
      { name: 'University of Stuttgart', short: 'Stuttgart', city: 'Stuttgart', state: 'Baden-Württemberg', qs: 312, the: 251 },
      { name: 'TU Dresden', short: 'TU Dresden', city: 'Dresden', state: 'Saxony', qs: 247, the: 201 },
      { name: 'University of Bonn', short: 'Bonn', city: 'Bonn', state: 'NRW', qs: 239, the: 91 },
      { name: 'University of Cologne', short: 'Cologne', city: 'Cologne', state: 'NRW', qs: 364, the: 156 },
      { name: 'TU Hamburg', short: 'TUHH', city: 'Hamburg', state: 'Hamburg', qs: 401, the: 251 },
      { name: 'Leibniz University Hannover', short: 'LUH', city: 'Hannover', state: 'Lower Saxony', qs: 462, the: 351 },
    ],
  },
  Singapore: {
    T1: [
      { name: 'National University of Singapore', short: 'NUS', city: 'Singapore', state: 'Singapore', qs: 8, the: 17 },
      { name: 'Nanyang Technological University', short: 'NTU', city: 'Singapore', state: 'Singapore', qs: 15, the: 30 },
    ],
    T2: [
      { name: 'Singapore Management University', short: 'SMU', city: 'Singapore', state: 'Singapore', qs: 545, the: 401 },
      { name: 'Singapore University of Technology and Design', short: 'SUTD', city: 'Singapore', state: 'Singapore', qs: 481, the: 251 },
    ],
    T3: [],
  },
  Ireland: {
    T1: [
      { name: 'Trinity College Dublin', short: 'TCD', city: 'Dublin', state: 'Leinster', qs: 87, the: 152 },
      { name: 'University College Dublin', short: 'UCD', city: 'Dublin', state: 'Leinster', qs: 126, the: 201 },
    ],
    T2: [
      { name: 'University of Galway', short: 'UoG', city: 'Galway', state: 'Connacht', qs: 273, the: 351 },
      { name: 'University College Cork', short: 'UCC', city: 'Cork', state: 'Munster', qs: 273, the: 401 },
      { name: 'Dublin City University', short: 'DCU', city: 'Dublin', state: 'Leinster', qs: 421, the: 601 },
    ],
    T3: [
      { name: 'University of Limerick', short: 'UL', city: 'Limerick', state: 'Munster', qs: 426, the: 501 },
      { name: 'Maynooth University', short: 'Maynooth', city: 'Maynooth', state: 'Leinster', qs: 801, the: 801 },
    ],
  },
  Netherlands: {
    T1: [
      { name: 'Delft University of Technology', short: 'TU Delft', city: 'Delft', state: 'South Holland', qs: 56, the: 65 },
      { name: 'University of Amsterdam', short: 'UvA', city: 'Amsterdam', state: 'North Holland', qs: 60, the: 60 },
      { name: 'Eindhoven University of Technology', short: 'TU/e', city: 'Eindhoven', state: 'North Brabant', qs: 124, the: 200 },
    ],
    T2: [
      { name: 'Erasmus University Rotterdam', short: 'EUR', city: 'Rotterdam', state: 'South Holland', qs: 176, the: 99 },
      { name: 'Utrecht University', short: 'Utrecht', city: 'Utrecht', state: 'Utrecht', qs: 105, the: 78 },
      { name: 'Leiden University', short: 'Leiden', city: 'Leiden', state: 'South Holland', qs: 119, the: 78 },
      { name: 'University of Groningen', short: 'RUG', city: 'Groningen', state: 'Groningen', qs: 139, the: 80 },
    ],
    T3: [
      { name: 'Tilburg University', short: 'Tilburg', city: 'Tilburg', state: 'North Brabant', qs: 348, the: 201 },
      { name: 'Maastricht University', short: 'Maastricht', city: 'Maastricht', state: 'Limburg', qs: 233, the: 145 },
      { name: 'Radboud University', short: 'Radboud', city: 'Nijmegen', state: 'Gelderland', qs: 240, the: 116 },
    ],
  },
  France: {
    T1: [
      { name: 'PSL University', short: 'PSL', city: 'Paris', state: 'Île-de-France', qs: 24, the: 47 },
      { name: 'Sorbonne University', short: 'Sorbonne', city: 'Paris', state: 'Île-de-France', qs: 59, the: 89 },
      { name: 'Polytechnique', short: 'X', city: 'Palaiseau', state: 'Île-de-France', qs: 26, the: 95 },
      { name: 'HEC Paris', short: 'HEC', city: 'Jouy-en-Josas', state: 'Île-de-France', qs: 66, the: 351 },
    ],
    T2: [
      { name: 'INSEAD', short: 'INSEAD', city: 'Fontainebleau', state: 'Île-de-France', qs: 99, the: 251 },
      { name: 'CentraleSupélec', short: 'CentraleSupelec', city: 'Gif-sur-Yvette', state: 'Île-de-France', qs: 142, the: 401 },
      { name: 'Sciences Po', short: 'Sciences Po', city: 'Paris', state: 'Île-de-France', qs: 254, the: 401 },
      { name: 'ESSEC Business School', short: 'ESSEC', city: 'Cergy', state: 'Île-de-France', qs: 251, the: 601 },
    ],
    T3: [
      { name: 'Grenoble Alpes University', short: 'UGA', city: 'Grenoble', state: 'Auvergne-Rhône-Alpes', qs: 305, the: 251 },
      { name: 'Aix-Marseille University', short: 'AMU', city: 'Marseille', state: 'PACA', qs: 482, the: 251 },
    ],
  },
  Switzerland: {
    T1: [
      { name: 'ETH Zurich', short: 'ETH', city: 'Zurich', state: 'Zurich', qs: 7, the: 11 },
      { name: 'EPFL', short: 'EPFL', city: 'Lausanne', state: 'Vaud', qs: 26, the: 33 },
    ],
    T2: [
      { name: 'University of Zurich', short: 'UZH', city: 'Zurich', state: 'Zurich', qs: 91, the: 80 },
      { name: 'University of Geneva', short: 'UNIGE', city: 'Geneva', state: 'Geneva', qs: 162, the: 91 },
      { name: 'University of Basel', short: 'Basel', city: 'Basel', state: 'Basel-Stadt', qs: 124, the: 99 },
    ],
    T3: [
      { name: 'University of Bern', short: 'Bern', city: 'Bern', state: 'Bern', qs: 124, the: 178 },
      { name: 'University of Lausanne', short: 'UNIL', city: 'Lausanne', state: 'Vaud', qs: 172, the: 187 },
    ],
  },
  Sweden: {
    T1: [
      { name: 'KTH Royal Institute of Technology', short: 'KTH', city: 'Stockholm', state: 'Stockholm', qs: 73, the: 200 },
      { name: 'Karolinska Institutet', short: 'KI', city: 'Stockholm', state: 'Stockholm', qs: 130, the: 51 },
      { name: 'Lund University', short: 'Lund', city: 'Lund', state: 'Skåne', qs: 75, the: 105 },
    ],
    T2: [
      { name: 'Uppsala University', short: 'Uppsala', city: 'Uppsala', state: 'Uppsala', qs: 105, the: 116 },
      { name: 'Chalmers University of Technology', short: 'Chalmers', city: 'Gothenburg', state: 'Västra Götaland', qs: 139, the: 351 },
      { name: 'Stockholm University', short: 'SU', city: 'Stockholm', state: 'Stockholm', qs: 153, the: 174 },
    ],
    T3: [],
  },
  'New Zealand': {
    T1: [
      { name: 'University of Auckland', short: 'Auckland', city: 'Auckland', state: 'Auckland', qs: 65, the: 152 },
    ],
    T2: [
      { name: 'University of Otago', short: 'Otago', city: 'Dunedin', state: 'Otago', qs: 214, the: 301 },
      { name: 'Victoria University of Wellington', short: 'VUW', city: 'Wellington', state: 'Wellington', qs: 244, the: 401 },
      { name: 'University of Canterbury', short: 'UC', city: 'Christchurch', state: 'Canterbury', qs: 261, the: 501 },
      { name: 'Massey University', short: 'Massey', city: 'Palmerston North', state: 'Manawatū', qs: 239, the: 501 },
    ],
    T3: [
      { name: 'University of Waikato', short: 'Waikato', city: 'Hamilton', state: 'Waikato', qs: 250, the: 401 },
      { name: 'Auckland University of Technology', short: 'AUT', city: 'Auckland', state: 'Auckland', qs: 412, the: 251 },
    ],
  },
  Japan: {
    T1: [
      { name: 'University of Tokyo', short: 'UTokyo', city: 'Tokyo', state: 'Tokyo', qs: 32, the: 28 },
      { name: 'Kyoto University', short: 'Kyoto', city: 'Kyoto', state: 'Kyoto', qs: 46, the: 55 },
    ],
    T2: [
      { name: 'Osaka University', short: 'Osaka', city: 'Osaka', state: 'Osaka', qs: 80, the: 175 },
      { name: 'Tokyo Institute of Technology', short: 'Tokyo Tech', city: 'Tokyo', state: 'Tokyo', qs: 84, the: 191 },
      { name: 'Tohoku University', short: 'Tohoku', city: 'Sendai', state: 'Miyagi', qs: 113, the: 130 },
    ],
    T3: [
      { name: 'Waseda University', short: 'Waseda', city: 'Tokyo', state: 'Tokyo', qs: 199, the: 801 },
      { name: 'Keio University', short: 'Keio', city: 'Tokyo', state: 'Tokyo', qs: 188, the: 601 },
    ],
  },
  'South Korea': {
    T1: [
      { name: 'Seoul National University', short: 'SNU', city: 'Seoul', state: 'Seoul', qs: 31, the: 62 },
      { name: 'KAIST', short: 'KAIST', city: 'Daejeon', state: 'Daejeon', qs: 53, the: 71 },
    ],
    T2: [
      { name: 'POSTECH', short: 'POSTECH', city: 'Pohang', state: 'North Gyeongsang', qs: 98, the: 251 },
      { name: 'Yonsei University', short: 'Yonsei', city: 'Seoul', state: 'Seoul', qs: 56, the: 89 },
      { name: 'Korea University', short: 'Korea Univ', city: 'Seoul', state: 'Seoul', qs: 67, the: 109 },
    ],
    T3: [
      { name: 'Sungkyunkwan University', short: 'SKKU', city: 'Seoul', state: 'Seoul', qs: 145, the: 130 },
      { name: 'Hanyang University', short: 'Hanyang', city: 'Seoul', state: 'Seoul', qs: 164, the: 401 },
    ],
  },
  India: {
    T1: [
      { name: 'Indian Institute of Technology Bombay', short: 'IIT Bombay', city: 'Mumbai', state: 'Maharashtra', qs: 118, the: 401 },
      { name: 'Indian Institute of Technology Delhi', short: 'IIT Delhi', city: 'New Delhi', state: 'Delhi', qs: 150, the: 501 },
      { name: 'Indian Institute of Technology Madras', short: 'IIT Madras', city: 'Chennai', state: 'Tamil Nadu', qs: 227, the: 601 },
      { name: 'Indian Institute of Science Bangalore', short: 'IISc', city: 'Bangalore', state: 'Karnataka', qs: 211, the: 251 },
      { name: 'Indian Institute of Management Ahmedabad', short: 'IIMA', city: 'Ahmedabad', state: 'Gujarat', qs: 999, the: 999 },
      { name: 'Indian Institute of Management Bangalore', short: 'IIMB', city: 'Bangalore', state: 'Karnataka', qs: 999, the: 999 },
      { name: 'Indian Institute of Management Calcutta', short: 'IIMC', city: 'Kolkata', state: 'West Bengal', qs: 999, the: 999 },
    ],
    T2: [
      { name: 'Indian Institute of Technology Kanpur', short: 'IIT Kanpur', city: 'Kanpur', state: 'Uttar Pradesh', qs: 263, the: 601 },
      { name: 'Indian Institute of Technology Kharagpur', short: 'IIT KGP', city: 'Kharagpur', state: 'West Bengal', qs: 222, the: 601 },
      { name: 'Indian Institute of Technology Roorkee', short: 'IIT Roorkee', city: 'Roorkee', state: 'Uttarakhand', qs: 335, the: 401 },
      { name: 'Indian Institute of Technology Guwahati', short: 'IIT Guwahati', city: 'Guwahati', state: 'Assam', qs: 344, the: 601 },
      { name: 'BITS Pilani', short: 'BITS', city: 'Pilani', state: 'Rajasthan', qs: 668, the: 999 },
      { name: 'Indian Institute of Management Lucknow', short: 'IIML', city: 'Lucknow', state: 'Uttar Pradesh', qs: 999, the: 999 },
      { name: 'Indian Institute of Management Indore', short: 'IIMI', city: 'Indore', state: 'Madhya Pradesh', qs: 999, the: 999 },
      { name: 'NIT Tiruchirappalli', short: 'NIT Trichy', city: 'Tiruchirappalli', state: 'Tamil Nadu', qs: 999, the: 999 },
      { name: 'NIT Surathkal', short: 'NIT Surathkal', city: 'Mangalore', state: 'Karnataka', qs: 999, the: 999 },
      { name: 'NIT Warangal', short: 'NIT Warangal', city: 'Warangal', state: 'Telangana', qs: 999, the: 999 },
    ],
    T3: [
      { name: 'IIT Hyderabad', short: 'IITH', city: 'Hyderabad', state: 'Telangana', qs: 681, the: 601 },
      { name: 'IIT BHU Varanasi', short: 'IIT BHU', city: 'Varanasi', state: 'Uttar Pradesh', qs: 999, the: 999 },
      { name: 'NIT Calicut', short: 'NIT Calicut', city: 'Kozhikode', state: 'Kerala', qs: 999, the: 999 },
      { name: 'NIT Rourkela', short: 'NIT Rourkela', city: 'Rourkela', state: 'Odisha', qs: 999, the: 999 },
      { name: 'IIIT Hyderabad', short: 'IIIT-H', city: 'Hyderabad', state: 'Telangana', qs: 999, the: 999 },
      { name: 'Delhi Technological University', short: 'DTU', city: 'Delhi', state: 'Delhi', qs: 999, the: 999 },
      { name: 'VIT Vellore', short: 'VIT', city: 'Vellore', state: 'Tamil Nadu', qs: 793, the: 999 },
      { name: 'Manipal Institute of Technology', short: 'MIT Manipal', city: 'Manipal', state: 'Karnataka', qs: 999, the: 999 },
      { name: 'SRM Institute of Science and Technology', short: 'SRM', city: 'Chennai', state: 'Tamil Nadu', qs: 999, the: 999 },
      { name: 'Symbiosis Institute Pune', short: 'SIBM', city: 'Pune', state: 'Maharashtra', qs: 999, the: 999 },
    ],
  },
  Italy: {
    T1: [
      { name: 'Politecnico di Milano', short: 'PoliMi', city: 'Milan', state: 'Lombardy', qs: 111, the: 251 },
      { name: 'Sapienza University of Rome', short: 'Sapienza', city: 'Rome', state: 'Lazio', qs: 132, the: 201 },
      { name: 'University of Bologna', short: 'UniBo', city: 'Bologna', state: 'Emilia-Romagna', qs: 133, the: 161 },
    ],
    T2: [
      { name: 'University of Padua', short: 'Padua', city: 'Padua', state: 'Veneto', qs: 219, the: 251 },
      { name: 'Politecnico di Torino', short: 'PoliTo', city: 'Turin', state: 'Piedmont', qs: 252, the: 351 },
      { name: 'University of Milan', short: 'UniMi', city: 'Milan', state: 'Lombardy', qs: 285, the: 167 },
    ],
    T3: [
      { name: 'University of Pisa', short: 'UniPi', city: 'Pisa', state: 'Tuscany', qs: 349, the: 401 },
      { name: 'Bocconi University', short: 'Bocconi', city: 'Milan', state: 'Lombardy', qs: 871, the: 251 },
    ],
  },
  Spain: {
    T1: [
      { name: 'IE University', short: 'IE', city: 'Madrid', state: 'Madrid', qs: 332, the: 401 },
      { name: 'Universitat de Barcelona', short: 'UB', city: 'Barcelona', state: 'Catalonia', qs: 156, the: 161 },
    ],
    T2: [
      { name: 'Universidad Autónoma de Madrid', short: 'UAM', city: 'Madrid', state: 'Madrid', qs: 207, the: 251 },
      { name: 'Universidad Complutense de Madrid', short: 'UCM', city: 'Madrid', state: 'Madrid', qs: 191, the: 351 },
      { name: 'Universitat Politècnica de Catalunya', short: 'UPC', city: 'Barcelona', state: 'Catalonia', qs: 351, the: 351 },
      { name: 'Pompeu Fabra University', short: 'UPF', city: 'Barcelona', state: 'Catalonia', qs: 263, the: 156 },
    ],
    T3: [
      { name: 'University of Valencia', short: 'UV', city: 'Valencia', state: 'Valencia', qs: 348, the: 351 },
      { name: 'University of Granada', short: 'UGR', city: 'Granada', state: 'Andalusia', qs: 432, the: 401 },
    ],
  },
  'Hong Kong': {
    T1: [
      { name: 'University of Hong Kong', short: 'HKU', city: 'Hong Kong', state: 'Hong Kong', qs: 17, the: 35 },
      { name: 'Hong Kong University of Science and Technology', short: 'HKUST', city: 'Hong Kong', state: 'Hong Kong', qs: 47, the: 64 },
    ],
    T2: [
      { name: 'Chinese University of Hong Kong', short: 'CUHK', city: 'Hong Kong', state: 'Hong Kong', qs: 36, the: 53 },
      { name: 'City University of Hong Kong', short: 'CityU', city: 'Hong Kong', state: 'Hong Kong', qs: 62, the: 82 },
      { name: 'Hong Kong Polytechnic University', short: 'PolyU', city: 'Hong Kong', state: 'Hong Kong', qs: 57, the: 87 },
    ],
    T3: [],
  },
  China: {
    T1: [
      { name: 'Tsinghua University', short: 'Tsinghua', city: 'Beijing', state: 'Beijing', qs: 20, the: 12 },
      { name: 'Peking University', short: 'PKU', city: 'Beijing', state: 'Beijing', qs: 14, the: 13 },
      { name: 'Fudan University', short: 'Fudan', city: 'Shanghai', state: 'Shanghai', qs: 39, the: 36 },
      { name: 'Shanghai Jiao Tong University', short: 'SJTU', city: 'Shanghai', state: 'Shanghai', qs: 45, the: 43 },
      { name: 'Zhejiang University', short: 'ZJU', city: 'Hangzhou', state: 'Zhejiang', qs: 47, the: 55 },
    ],
    T2: [
      { name: 'University of Science and Technology of China', short: 'USTC', city: 'Hefei', state: 'Anhui', qs: 132, the: 53 },
      { name: 'Nanjing University', short: 'NJU', city: 'Nanjing', state: 'Jiangsu', qs: 145, the: 73 },
      { name: 'Tongji University', short: 'Tongji', city: 'Shanghai', state: 'Shanghai', qs: 192, the: 251 },
    ],
    T3: [
      { name: 'Beijing Normal University', short: 'BNU', city: 'Beijing', state: 'Beijing', qs: 263, the: 251 },
      { name: 'Sun Yat-sen University', short: 'SYSU', city: 'Guangzhou', state: 'Guangdong', qs: 219, the: 200 },
    ],
  },
  UAE: {
    T1: [
      { name: 'United Arab Emirates University', short: 'UAEU', city: 'Al Ain', state: 'Abu Dhabi', qs: 290, the: 601 },
      { name: 'Khalifa University', short: 'KU', city: 'Abu Dhabi', state: 'Abu Dhabi', qs: 230, the: 200 },
    ],
    T2: [
      { name: 'American University of Sharjah', short: 'AUS', city: 'Sharjah', state: 'Sharjah', qs: 369, the: 601 },
      { name: 'University of Sharjah', short: 'UoS', city: 'Sharjah', state: 'Sharjah', qs: 461, the: 601 },
    ],
    T3: [
      { name: 'Zayed University', short: 'ZU', city: 'Dubai', state: 'Dubai', qs: 999, the: 999 },
    ],
  },
  Denmark: {
    T1: [
      { name: 'University of Copenhagen', short: 'UCPH', city: 'Copenhagen', state: 'Capital Region', qs: 100, the: 87 },
      { name: 'Technical University of Denmark', short: 'DTU', city: 'Lyngby', state: 'Capital Region', qs: 105, the: 200 },
    ],
    T2: [
      { name: 'Aarhus University', short: 'AU', city: 'Aarhus', state: 'Central Denmark', qs: 145, the: 116 },
      { name: 'Aalborg University', short: 'AAU', city: 'Aalborg', state: 'North Denmark', qs: 326, the: 351 },
    ],
    T3: [],
  },
  Finland: {
    T1: [
      { name: 'University of Helsinki', short: 'UH', city: 'Helsinki', state: 'Uusimaa', qs: 115, the: 109 },
      { name: 'Aalto University', short: 'Aalto', city: 'Espoo', state: 'Uusimaa', qs: 109, the: 251 },
    ],
    T2: [
      { name: 'University of Turku', short: 'UTU', city: 'Turku', state: 'Southwest Finland', qs: 295, the: 351 },
      { name: 'Tampere University', short: 'TAU', city: 'Tampere', state: 'Pirkanmaa', qs: 354, the: 351 },
    ],
    T3: [],
  },
  Norway: {
    T1: [
      { name: 'University of Oslo', short: 'UiO', city: 'Oslo', state: 'Oslo', qs: 117, the: 116 },
      { name: 'Norwegian University of Science and Technology', short: 'NTNU', city: 'Trondheim', state: 'Trøndelag', qs: 270, the: 401 },
    ],
    T2: [
      { name: 'University of Bergen', short: 'UiB', city: 'Bergen', state: 'Vestland', qs: 242, the: 251 },
    ],
    T3: [],
  },
  Belgium: {
    T1: [
      { name: 'KU Leuven', short: 'KU Leuven', city: 'Leuven', state: 'Flemish Brabant', qs: 61, the: 45 },
    ],
    T2: [
      { name: 'Ghent University', short: 'UGent', city: 'Ghent', state: 'East Flanders', qs: 142, the: 78 },
      { name: 'University of Antwerp', short: 'UAntwerpen', city: 'Antwerp', state: 'Antwerp', qs: 235, the: 178 },
    ],
    T3: [],
  },
  Austria: {
    T1: [
      { name: 'University of Vienna', short: 'UniWien', city: 'Vienna', state: 'Vienna', qs: 120, the: 119 },
    ],
    T2: [
      { name: 'TU Wien', short: 'TU Wien', city: 'Vienna', state: 'Vienna', qs: 174, the: 401 },
      { name: 'University of Innsbruck', short: 'UIBK', city: 'Innsbruck', state: 'Tyrol', qs: 281, the: 351 },
    ],
    T3: [],
  },
}
