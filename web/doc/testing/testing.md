CRUD Menu Asseement
Edit:
- Ketika edit mau input "Role title" kenapa harus pilih lagi bahkan Input ulang lagi, harusnya bisa langsung di edit di input nya nerusin yg udah ada (UX 0)

Download PDF: ERROR
Request URL
http://localhost:3001/api/v1/portfolios/6/export?format=pdf
Request Method
GET
Status Code
500 Internal Server Error

{
    "errors": [
        {
            "status": 500,
            "message": "Your document includes text that's not compatible with the Windows-1252 character set.\nIf you need full UTF-8 support, use external fonts instead of PDF's built-in fonts.\n",
            "backtrace": [
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/fonts/afm.rb:116:in `rescue in normalize_encoding'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/fonts/afm.rb:111:in `normalize_encoding'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/text/formatted/box.rb:399:in `block in normalize_encoding'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/text/formatted/box.rb:393:in `each'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/text/formatted/box.rb:393:in `normalize_encoding'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/text/formatted/box.rb:371:in `normalized_text'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/text/formatted/box.rb:219:in `block (3 levels) in render'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/pdf-core-0.9.0/lib/pdf/core/text.rb:202:in `text_rendering_mode'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/prawn-2.4.0/lib/prawn/text/formatted/box.rb:216:in `block (2 levels) in render'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/pdf-core-0.9.0/lib/pdf/core/text.rb:227:in `character_spacing'"
            ]
        }
    ]
}

Filter Assesment status Waiting: Failed to load assessments. Please refresh the page.
Request URL
http://localhost:3001/api/v1/assessments?page=1&status=awaiting
Request Method
GET
Status Code
500 Internal Server Error

{
    "errors": [
        {
            "status": 500,
            "message": "PG::UndefinedColumn: ERROR:  column latest.id does not exist\nLINE 1: ...N TRUE WHERE \"assessments\".\"tenant_id\" = $1 AND ((latest.id ...\n                                                             ^\n",
            "backtrace": [
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activerecord-7.0.10/lib/active_record/connection_adapters/postgresql_adapter.rb:768:in `exec_params'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activerecord-7.0.10/lib/active_record/connection_adapters/postgresql_adapter.rb:768:in `block (2 levels) in exec_no_cache'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activesupport-7.0.10/lib/active_support/concurrency/share_lock.rb:187:in `yield_shares'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activesupport-7.0.10/lib/active_support/dependencies/interlock.rb:41:in `permit_concurrent_loads'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activerecord-7.0.10/lib/active_record/connection_adapters/postgresql_adapter.rb:767:in `block in exec_no_cache'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activesupport-7.0.10/lib/active_support/concurrency/load_interlock_aware_monitor.rb:25:in `handle_interrupt'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activesupport-7.0.10/lib/active_support/concurrency/load_interlock_aware_monitor.rb:25:in `block in synchronize'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activesupport-7.0.10/lib/active_support/concurrency/load_interlock_aware_monitor.rb:21:in `handle_interrupt'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activesupport-7.0.10/lib/active_support/concurrency/load_interlock_aware_monitor.rb:21:in `synchronize'",
                "/home/risna/.rbenv/versions/3.3.2/lib/ruby/gems/3.3.0/gems/activerecord-7.0.10/lib/active_record/connection_adapters/abstract_adapter.rb:752:in `block in log'"
            ]
        }
    ]
}

Auth Logout: Tambahkan dialog popup konfirmasi gt apakah mau logout?

== UI/UX
- Tambahkan toats pemberitahuan deh kalau misal berhasil create/edit/login/logout/dll data gt, jangan cuman pindah page doang bjir
- Hapus kata yg di header "Demo Tenant"

== BE
- tambahkan settime out ketika filter jadi ada jeda ga setiap saat hit api terus terusan



