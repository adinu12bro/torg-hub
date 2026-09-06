# TORG Hub

Build a real internal ERP + POS + Inventory + Sales + Customer CRM application for TORG Wholesale.



Existing customer-facing website:

https://www.torgwholesale.com



IMPORTANT:

Do NOT rebuild, replace, clone, or redesign the existing website. This is NOT an e-commerce website. Build a completely separate internal business management application used by the TORG owner, managers and staff.



Use the existing website only to understand TORG's products, categories, branding and wholesale business context.



TECHNOLOGY



Use:



- React + TypeScript

- Vite

- Tailwind CSS

- Supabase

- PostgreSQL

- Supabase Auth

- Supabase Storage



Make the architecture suitable for a future mobile/desktop application.



Build real working functionality connected to Supabase. Do not create fake/mock data for core business operations.



MAIN MODULES



Create these modules:



1. Dashboard

2. POS / New Sale

3. Products

4. Inventory

5. Barcode Scanner

6. Purchases

7. Suppliers

8. Customers

9. Sales History

10. Payments & Credit

11. Expenses

12. Reports & Analytics

13. Notifications

14. Users & Permissions

15. Settings

16. Audit Logs



DASHBOARD



Show:



- Today's sales

- Monthly sales

- Revenue

- Gross profit

- Net profit

- Profit margin

- Inventory value

- Potential inventory profit

- Low-stock products

- Out-of-stock products

- Fast/high-volume products

- Slow/dead stock

- Outstanding customer balances

- Top products

- Top customers

- Recent sales

- Recent inventory activity



Add date filters and useful charts.



PRODUCT SYSTEM



Create products with:



- Product name

- SKU

- Barcode

- Category

- Subcategory

- Brand

- Description

- Images

- Sizes

- Colors

- Variants

- Supplier

- Buy price

- Selling price

- Wholesale price

- Current stock

- Minimum stock

- High-volume threshold

- MOQ

- Active/archived status



Calculate:



Profit per unit = Selling price - Buy price



Margin % = Profit / Selling price × 100



Products must support multiple variants such as:



Product → Color → Size → SKU → Barcode → Stock



Do not store all variants as one simple stock number.



Allow authorized users to create, edit, archive and restore products.



BARCODE SCANNER



Barcode scanning is required for V1.



Support:



- Camera barcode scanning

- Manual SKU/barcode search

- USB/Bluetooth barcode scanners where supported



Workflow:



SCAN → FIND PRODUCT → SHOW PRODUCT + VARIANT + STOCK + SELL PRICE → ADD TO CART/ACTION



Also allow scanning for stock receiving and inventory lookup.



If barcode is unknown, show "Product Not Found" and allow authorized users to create the product and assign the barcode.



IMPORTANT:

Do NOT implement QR-code scanning now. The database should simply be designed so QR support can be added in a future version.



INVENTORY



Create a proper inventory ledger.



Support:



- Receive stock

- Sell stock

- Stock adjustment

- Add/remove stock

- Damaged stock

- Lost stock

- Returned stock

- Stock transfers

- Stock count

- Inventory history



Every inventory movement must record:



Product

Variant

Previous quantity

Quantity changed

New quantity

Movement type

Reason

User

Timestamp

Related sale/purchase when applicable



Never silently change inventory.



Prevent negative stock unless explicitly enabled by Admin.



STOCK ALERTS



Create alerts for:



- Low stock

- Out of stock

- Fast-moving products

- High-volume sales

- Popular sizes/colors

- Reorder requirements

- Sudden sales increases



Low-stock alerts should show current stock, minimum stock, supplier and suggested reorder quantity.



STOCK COUNT



Create stock-count sessions.



Show:



System quantity

Physical quantity

Difference



Require Manager/Admin approval before applying differences.



Record every adjustment in the audit log.



PURCHASES



Create purchase management.



Purchase fields:



Supplier

Reference number

Date

Products

Variants

Quantity

Buy price

Total cost

Notes



Confirmed purchases increase inventory.



SUPPLIERS



Store:



Supplier name

Contact person

Phone

WhatsApp

Email

Address

Products supplied

Purchase history

Total purchase value



POS



Create a fast internal wholesale POS.



Main workflow:



SCAN → CART → CUSTOMER → QUANTITY → DISCOUNT → PAYMENT → COMPLETE SALE



Support:



- Barcode scanning

- Product search

- Variants

- Quantity editing

- Discounts

- Walk-in customers

- Existing customers

- New customer creation

- Credit sales

- Multiple payment methods



Calculate:



Revenue = Selling price × quantity



Cost = Buy price × quantity



Profit = Revenue - Cost - Discount



Buy price and profit must only be visible to authorized users.



When completing a sale, ensure the operation is atomic:



1. Validate products and stock

2. Create sale

3. Create sale items

4. Record payment

5. Deduct stock exactly once

6. Calculate revenue/cost/profit

7. Update customer history

8. Create audit log



Prevent duplicate sales and double stock deduction.



SALES HISTORY



Store:



Sale ID

Customer/shop

Products

Variants

Quantity

Selling price

Discount

Revenue

Cost

Profit

Payment status

Payment method

Staff member

Timestamp



Allow authorized users to search, filter, view and cancel sales.



RETURNS



Allow users to find the original sale and select products/quantities to return.



Record:



Return reason

Returned quantity

Refund/credit

User

Timestamp



Never allow returned quantity to exceed the quantity originally sold.



Correct inventory, payment and profit records.



CUSTOMER CRM



Customer fields:



Name

Shop/business name

Contact number

WhatsApp

Email

Address

City

State

Country

Instagram username/page

Notes

Status



Customer profile should show:



Total orders

Total purchases

Revenue

Profit generated

Last purchase

Favourite products

Purchase frequency

Average order value

Outstanding balance



Quick actions:



Call

WhatsApp

Instagram

New Sale

Purchase History



Classify customers such as:



Top customers

High-profit customers

Frequent customers

New customers

Returning customers

Inactive customers



PAYMENTS + CREDIT



Payment methods:



Cash

UPI

Card

Bank Transfer

Other configurable methods



Statuses:



Paid

Partial

Unpaid

Credit



Track:



Amount paid

Balance

Due date

Overdue amount

Payment history



Support multiple payments against a sale.



EXPENSES



Create expense tracking.



Categories:



Transport

Packaging

Rent

Salary

Marketing

Electricity

Maintenance

Other



Calculate:



Gross Profit = Revenue - Product Cost



Net Profit = Gross Profit - Expenses



REPORTS



Create reports for:



Sales

Revenue

Profit

Profit margin

Inventory

Stock movements

Purchases

Products

Customers

Suppliers

Low stock

Dead stock

Fast-moving products

Expenses

Payments

Returns



Filters:



Date

Product

Category

Customer

Supplier

Staff



Add CSV export and PDF export where practical.



USERS + PERMISSIONS



Create roles:



Staff

Manager

Admin

Super Admin



Use role-based permissions.



Staff should have limited access.



Managers can manage daily operations and approve stock adjustments.



Admins can manage products, prices, suppliers, expenses and reports.



Super Admin has full access.



Sensitive actions such as changing buy prices, stock adjustments, refunds, deleting/cancelling records and user management must require proper authorization.



SECURITY



Use:



Supabase Auth

PostgreSQL Row Level Security

Server-side authorization

Database constraints

Input validation

Audit logs

Least-privilege permissions



Never trust frontend values for:



Prices

Profit

Stock

Quantity

Roles

Permissions

Payment status



Critical calculations and operations must be validated server-side.



Never expose Supabase service-role keys or private secrets in frontend code.



Never hardcode secrets.



Protect against unauthorized access, IDOR, injection, unsafe uploads and duplicate transactions.



AUDIT LOGS



Record important actions:



Product changes

Price changes

Inventory changes

Purchases

Sales

Returns

Payments

Customer changes

Expense changes

User/permission changes



Store:



User

Action

Resource

Previous value

New value

Reason

Timestamp



Never log passwords or authentication tokens.



DATABASE



Use a normalized PostgreSQL structure with:



UUID primary keys

Foreign keys

Indexes

Constraints

Timestamps

Proper relationships

Database migrations

RLS policies



Core tables:



profiles

roles

permissions

user_roles

products

categories

product_variants

barcodes

inventory

inventory_movements

stock_counts

stock_count_items

suppliers

purchases

purchase_items

customers

sales

sale_items

payments

payment_allocations

returns

return_items

expenses

notifications

audit_logs



Design the schema so future features such as QR scanning, invoice printing, warehouses, purchase orders and PDF invoices can be added without rebuilding the core system.



UI/UX



Do NOT copy the existing TORG website.



Create a dedicated modern business ERP interface.



Desktop:



Sidebar navigation

Dashboard

Data tables

Search

Filters

Charts

Fast POS interface

Keyboard-friendly controls



Mobile:



Bottom navigation

Large Scan button

Quick Sale

Quick Stock

Quick Customer

Quick Product



Prioritize speed and usability for real shop/warehouse staff.



Include:



Dark/light mode

Responsive design

Loading states

Empty states

Error handling

Confirmation dialogs

Form validation

Accessible controls



IMPORTANT DEVELOPMENT RULES



Build real functionality, not a visual prototype.



Do not use fake business data for production logic.



Do not create unnecessary features just for appearance.



Keep business calculations centralized and consistent.



Use database transactions/RPC/server-side logic for critical sales and inventory operations.



Do not allow a sale to partially complete.



Do not allow stock to be deducted twice.



Do not delete important financial history; use cancellation/archiving where appropriate.



BUILD ORDER



Build and verify in this order:



1. Supabase database + migrations + RLS

2. Authentication

3. Roles and permissions

4. Product/category/variant system

5. Barcode system

6. Inventory ledger

7. Stock alerts/counting

8. Suppliers and purchases

9. POS and sales

10. Customers

11. Payments and credit

12. Returns

13. Expenses

14. Dashboard

15. Reports/analytics

16. Notifications

17. Audit logs

18. Security testing

19. Performance optimization



After each module, verify that it actually works with Supabase before moving to the next module.



The final core workflow must work reliably:



SCAN → PRODUCT → STOCK/PRICE/PROFIT → CART → CUSTOMER/SHOP → PAYMENT → COMPLETE SALE → STOCK DEDUCTED → PROFIT RECORDED → CUSTOMER HISTORY UPDATED → DASHBOARD UPDATED



This application is an INTERNAL TORG WHOLESALE ERP + POS, not a replacement for the existing TORG website.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/713f162a-4777-4f08-93c1-a7ef72b255b7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
