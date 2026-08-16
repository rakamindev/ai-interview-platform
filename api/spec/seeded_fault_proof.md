# Seeded Fault Test Proof (RSpec Harness Validation)

This serves as the proof of correctness for our automated test suite on the backend. We deliberately bypassed the tenant isolation controls (tenant scoping) to verify that the RSpec test suite catches the security vulnerability and correctly fails.

---

## 🧪 1. Deliberate Code Modification (Seeded Fault)

In [`PortfoliosController`](../app/controllers/api/v1/portfolios_controller.rb), the tenant isolation scope was temporarily removed from the `export` action:

```ruby
# ORIGINAL (Secure Scoped Query)
@portfolio = Portfolio.for_tenant(current_tenant_id).find(params[:id])

# BYPASSED (Vulnerable Global Query)
@portfolio = Portfolio.find(params[:id])
```

---

## 🔴 2. Resulting Test Failure (RED State)

Running the test suite after the bypass immediately triggered failures in the multi-tenant request specs, proving that the test harness actively flags unauthorized cross-tenant data access:

```bash
/opt/homebrew/bin/rbenv exec bundle exec rspec spec/requests/api/v1/portfolios_spec.rb
```

### Output Snippet:
```text
Failures:

  1) Api::V1::Portfolios GET /api/v1/portfolios/:id/export when authenticated as Tenant A blocks exporting Tenant B portfolio
     Failure/Error: expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))

          expected the response to have a not_found status code (404) but it was 200

       ...or:

          expected the response to have status code :forbidden (403) but it was :ok (200)
     # ./spec/requests/api/v1/portfolios_spec.rb:120:in `block (4 levels) in <top (required)>'
```

---

## 🟢 3. Revert & Recovery (GREEN State)

The bypass was reverted back to the secure tenant scoping query:
```ruby
@portfolio = Portfolio.for_tenant(current_tenant_id).find(params[:id])
```

Rerunning the tests confirmed that the system recovered to a fully secure and passing state:
```bash
/opt/homebrew/bin/rbenv exec bundle exec rspec spec/requests/api/v1/portfolios_spec.rb
```
```text
Finished in 0.303 seconds (files took 0.84 seconds to load)
9 examples, 0 failures
```
