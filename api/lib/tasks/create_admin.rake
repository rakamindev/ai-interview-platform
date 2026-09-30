# lib/tasks/create_admin.rake
namespace :create_admin do
  desc "Create a default admin user if one does not exist"
  task :create_default_admin => :environment do
    email = ENV.fetch('DEFAULT_ADMIN_EMAIL', 'admin@example.com')
    password = ENV.fetch('DEFAULT_ADMIN_PASSWORD', 'password')
    tenant_scheme = ENV.fetch('DEFAULT_TENANT_SCHEME', 'test-corp') # Based on resolve_scheme in authentication_controller

    # Ensure an organization exists, as users are tied to organizations
    organization = Organization.find_or_create_by!(scheme: tenant_scheme) do |org|
      org.name = "Default Organization"
      org.identifier = tenant_scheme # Add identifier for new organization
      org.host = 'test.host' # Add a default host
    end

    if User.find_by(email: email, organization_id: organization.id).nil?
      user = User.new(
        email: email,
        password: password,
        password_confirmation: password,
        role: 'admin',
        organization_id: organization.id
      )

    if user.save
      puts "Successfully created default admin user: #{email}"
    else
      puts "Failed to create default admin user: #{user.errors.full_messages.join(', ')}"
    end

    admin_user = User.find_by(email: email, organization_id: organization.id)

    if admin_user
      assessment_id = "00000000-0000-0000-0000-000000000001" # Fixed UUID for default assessment

      assessment = Assessment.find_or_create_by!(id: assessment_id, name: "Senior Frontend Engineer", tenant_id: organization.id) do |a|
        a.created_by = admin_user.id
        a.time_limit_min = 45
        a.language = 'en'
        a.system_prompt = "You are an expert skills assessor... (system prompt content)"
        # Add assessment skills
        a.assessment_skills_attributes = [
          {
            skill_label: "React / Frontend Development Core",
            expected_level: 3,
            is_custom: false,
            scope_include: "Component design, state management (Redux/Context), hooks, performance optimization, code splitting, testing (Jest/RTL)",
            l1_anchor: "Implements components from specs with close review. Understands JSX and basic hooks (useState, useEffect).",
            l2_anchor: "Builds routine features independently. Uses Context or Redux for shared state. Writes basic unit tests.",
            l3_anchor: "Designs and builds complex features end-to-end. Optimizes rendering (memoization, code splitting). Owns test strategy for their area.",
            l4_anchor: "Defines frontend standards for the team. Leads architecture decisions (state strategy, folder structure, build pipeline).",
            l5_anchor: "Defines frontend architecture strategy for the org. Drives cross-team adoption of patterns. Innovates on DX and performance at scale."
          }
        ]
      end
      puts "Successfully created/found default assessment: #{assessment.name} (ID: #{assessment.id})"
    else
      puts "Admin user not found, skipping assessment creation."
    end
    else
      puts "Default admin user '#{email}' already exists for organization '#{organization.name}'."
    end
  end
end