-- Xóa toàn bộ dữ liệu hộ / chỉ số / hóa đơn (giữ tài khoản admin + system_settings).
-- Chạy trước khi import dữ liệu thật. Không COMMIT riêng — gọi từ script bọc transaction.

DELETE FROM payment;
DELETE FROM invoice_send_log;
DELETE FROM invoice;
DELETE FROM meter_reading;
DELETE FROM notification;
DELETE FROM household;

-- Giữ user admin; xóa hộ dân và user mock (0931000*).
DELETE FROM "user"
WHERE phone <> 'admin';

DELETE FROM billing_period;
DELETE FROM collection_route;
DELETE FROM price_group;

DELETE FROM audit_log;
