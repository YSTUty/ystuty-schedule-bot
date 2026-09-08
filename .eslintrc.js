module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    // В legacy-контекстах `{}` используется как identity type для generic-расширений.
    '@typescript-eslint/no-empty-object-type': [
      'error',
      { allowObjectTypes: 'always' },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "ImportDeclaration[source.value='telegraf-hardened'] > ImportSpecifier[imported.name='Markup'][local.name='Markup']",
        message:
          'Use TelegramMarkup instead so callback_data is checked against the Telegram byte limit.',
      },
      {
        selector:
          "ImportDeclaration[source.value='nestjs-telega'] > ImportSpecifier[imported.name='Action'][local.name='Action']",
        message:
          'Use the local Action decorator so callback_data triggers are validated.',
      },
    ],
  },
};
