# Core

Chứa kiểu dữ liệu, hợp đồng và tiện ích kỹ thuật dùng chung, không phụ thuộc vào module nghiệp vụ cụ thể. Quy tắc nghiệp vụ vẫn thuộc module sở hữu nó; chỉ đưa code vào `core` khi có ít nhất hai module cần cùng một quy tắc tổng quát. Ví dụ, so sánh khoảng thời gian dùng chung nằm tại `time/intervals.ts`.
