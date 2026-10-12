/** @type {import('next').NextConfig} */
module.exports = {
  serverExternalPackages: ['pg', 'exceljs'],
  experimental: { serverComponentsExternalPackages: ['pg', 'exceljs'] },
};
