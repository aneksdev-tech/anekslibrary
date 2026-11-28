export const colleges = [
  {
    id: "CAERSE",
    name: "College of Agricultural Economics, Rural Sociology & Extension",
    departments: [
      "Agribusiness and Management",
      "Agricultural Economics",
      "Agricultural Extension and Rural Sociology",
    ],
  },

  {
    id: "CASAP",
    name: "College Of Animal Science & Animal Production",
    departments: [
      "Animal Breeding And Physiology",
      "Animal Nutrition And Forage Science",
      "Animal Production and Livestock Management",
    ],
  },

  {
    id: "CAFST",
    name: "College Of Applied Food Science & Tourism",
    departments: [
      "Human Nutrition and Dietetics",
      "Home Science/Hospitality Management & Tourism",
      "Food Science and Technology",
    ],
  },

  {
    id: "CCSS",
    name: "College Of Crop & Soil Sciences",
    departments: [
      "Agronomy",
      "Plant Health Management",
      "Soil Science and Meteorology",
      "Water Resources Management and Agrometeorology",
    ],
  },

  {
    id: "COED",
    name: "College Of Education",
    departments: [
      "Adult and Continuing Education",
      "Agricultural/Home Science Education",
      "Business Education",
      "Economics Education",
      "Education Management",
      "Industrial Technology Education",
      "Library and Information Science",
      "Guidance and Counselling",
      "Integrated Science Education",
    ],
  },

  {
    id: "CEET",
    name: "College Of Engineering & Engineering Technology",
    departments: [
      "Agricultural and Bioresources Engineering",
      "Civil Engineering",
      "Chemical Engineering",
      "Computer Engineering",
      "Electrical and Electronics Engineering",
      "Mechanical Engineering",
    ],
  },

  {
    id: "COLMAS",
    name: "College of Management Sciences",
    departments: [
      "Marketing",
      "Accounting",
      "Banking and Finance",
      "Economics",
      "Industrial Relations and Personnel Management",
      "Entrepreneurial Studies",
      "Business Administration",
    ],
  },

  {
    id: "CNREM",
    name: "College Of Natural Resources & Environmental Management",
    departments: [
      "Environment Management and Toxicology",
      "Fisheries and Aquatic Resources Management",
      "Forestry and Environmental Management",
    ],
  },

  {
    id: "COLNAS",
    name: "College of Natural and Applied Sciences",
    departments: [
      "Biochemistry",
      "Microbiology",
      "Plant Science and Biotechnology",
      "Zoology and Environmental Biology",
    ],
  },

  {
    id: "COLPAS",
    name: "College Of Physical & Applied Sciences",
    departments: [
      "Chemistry",
      "Computer Science",
      "Geology",
      "Mathematics",
      "Physics",
      "Statistics",
    ],
  },

  {
    id: "CVM",
    name: "College Of Veterinary Medicine",
    departments: [
      "Theriogenology",
      "Veterinary Anatomy",
      "Veterinary Medicine",
      "Veterinary Microbiology",
      "Veterinary Public Health and Preventive Medicine",
      "Veterinary Surgery and Radiology",
    ],
  },

  {
    id: "SGS",
    name: "School Of General Studies",
    departments: [
      "English",
      "French",
      "German",
      "History",
      "Social Science",
      "Physical and Health",
      "Philosophy",
      "Peace and Conflict",
    ],
  },
] as const;

export const levels = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
] as const;

export const semesters = [
  "First Semester",
  "Second Semester",
] as const;

export const years = Array.from(
  { length: 15 },
  (_, i) => new Date().getFullYear() - 5 + i,
);

export function getDepartments(
  collegeId: string,
) {
  return (
    colleges.find(
      (college) => college.id === collegeId,
    )?.departments ?? []
  );
}

export function getCollegeName(
  collegeId: string,
) {
  return (
    colleges.find(
      (college) => college.id === collegeId,
    )?.name ?? collegeId
  );
}

export function getCollege(
  collegeId: string,
) {
  return colleges.find(
    (college) => college.id === collegeId,
  );
}

export const ALL_OPTION = "all";