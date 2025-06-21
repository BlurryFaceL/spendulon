// Static mapping of default category names to their UUIDs in DynamoDB
// Auto-generated on 2025-06-08T02:59:28.046Z
// Generated from categories table - DO NOT EDIT MANUALLY

export const DEFAULT_CATEGORY_MAPPINGS = {
  // Income categories
  'Investments': '48912a88-e01b-4c38-ae41-0d0170f3a777',
  'Bonus': '56d13643-ed7f-4ef7-b49c-8c359c6709d4',
  'Other Income': '633e304f-b5b8-4a6f-b7fd-7f0d61d7aa26',
  'Salary': '7d014b99-c281-4e43-8790-40d382a8aa2e',
  'Freelance': 'bd9dcb17-9205-4531-8448-26fbcf987bec',
  'Dividends': 'c8329f7a-c06b-4b26-a010-479e0fe84442',
  'Business': 'd6b12ad1-160b-4cac-b280-09e065ab8f7f',
  'Gifts': 'd8392dc6-47a1-42f6-a76c-41cb3bcb3974',
  'Cashback': 'dc585b9d-de28-4f07-acb8-c03ed31692e4',

  // Expense categories
  'Loan Payments': '0428dd88-ae63-429b-9188-09f2b25d4c17',
  'Car Maintenance': '0ca5598b-a4e9-4cb3-9eed-cc6084e44a85',
  'Fuel': '16afb404-ac4e-4215-b23d-53cb3201f8f0',
  'Healthcare': '2001d8ae-31b1-4c86-9adb-cb38948dfa49',
  'Entertainment': '2065324b-35f5-4ad8-9703-40eb8f6e90fe',
  'Fitness': '294ce76e-9467-401e-b868-4261b5bf18b4',
  'Maintenance': '45191cb1-b11f-4ed8-8238-0946a4066f16',
  'Phone': '48e62b03-4255-4db0-b928-c3e4d3ac119c',
  'Food & Drink': '4c5e42f2-dc1f-4c0c-932c-8c20414fbb75',
  'Beauty & Personal Care': '7edd7b04-475b-4ec1-9dd1-8e2070cb346b',
  'Books': '7f96ba7f-ba04-4fd9-a99f-aace67157d00',
  'Education': '9a143b9a-396b-4be5-bd3c-7c61471f5fd6',
  'Transport': 'a8dbaea4-bf9b-4b42-9b67-09f8225c9360',
  'Gifts & Donations': 'b41237a5-14bd-4d55-9f6c-288300c40ed8',
  'Taxes': 'b99389f5-e9b1-4789-a5df-86ff1525a7a4',
  'Medicines': 'c2be80fb-88bb-4a80-bc37-223e24d83a34',
  'Miscellaneous': 'cd0b00c8-c738-42bc-a0d5-50a6117937d3',
  'Utilities': 'cd4b3fe9-c496-4f2f-9bf9-b49924e1fa4c',
  'Home Improvement': 'd7bb23d0-0347-4fe8-934e-3902d2ace2c1',
  'Clothing': 'da9de5f0-e018-4b3f-9e2e-0abb09e0e853',
  'Internet': 'e705505d-befb-4186-8f32-f106172e6823',
  'Groceries': 'e71822cb-7962-4865-a789-4c8b74fd7156',
  'Travel': 'e7c5795c-8451-46b8-960e-218faed092c4',
  'Shopping': 'e97bf499-92ff-4700-8415-d505315702ac',
  'Subscriptions': 'f388ba45-bfab-413b-a079-8ec00974f0db',
  'Rent': 'fbbbc1ff-f9c5-4925-8a86-9697b4a0533a',
  'Insurance': 'fbc9c701-729e-44ba-85f5-a57c81fed015',
};

// Reverse mapping for quick lookups
export const UUID_TO_NAME_MAPPING = Object.fromEntries(
  Object.entries(DEFAULT_CATEGORY_MAPPINGS).map(([name, uuid]) => [uuid, name])
);
