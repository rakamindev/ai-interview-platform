require 'rails_helper'

RSpec.describe AuthorizeApiRequest do
  let(:user) { OpenStruct.new(id: 1, role: 'admin', scheme: 'test-corp') }
  let(:header) { { 'Authorization' => "Bearer #{token}" } }
  let(:subject) { described_class.new(header, roles) }
  let(:roles) { [] }
  let(:token) { JsonWebToken.encode(user_id: user.id, role: user.role, scheme: user.scheme) }

  describe '#call' do
    context 'when valid request' do
      it 'returns user object and claims' do
        result = subject.call
        expect(result[:user].id).to eq(user.id)
        expect(result[:user].role).to eq(user.role)
        expect(result[:user].scheme).to eq(user.scheme)
        expect(result[:claims][:user_id]).to eq(user.id)
      end
    end

    context 'when checking roles' do
      context 'with allowed role' do
        let(:roles) { ['admin'] }

        it 'succeeds' do
          expect { subject.call }.not_to raise_error
        end
      end

      context 'with "any" role' do
        let(:roles) { ['any'] }

        it 'succeeds for any valid token' do
          expect { subject.call }.not_to raise_error
        end
      end

      context 'with "assessor" role mapping' do
        let(:roles) { ['assessor'] }

        it 'succeeds for admin user' do
          expect { subject.call }.not_to raise_error
        end

        context 'when user is assessor' do
          let(:user) { OpenStruct.new(id: 1, role: 'assessor', scheme: 'test-corp') }

          it 'succeeds for assessor user' do
            expect { subject.call }.not_to raise_error
          end
        end

        context 'when user is neither admin nor assessor' do
          let(:user) { OpenStruct.new(id: 1, role: 'regular', scheme: 'test-corp') }

          it 'raises Unauthorized' do
            expect { subject.call }.to raise_error(ExceptionHandler::Unauthorized, Message.unauthorized)
          end
        end
      end

      context 'with unauthorized role' do
        let(:roles) { ['superadmin'] }

        it 'raises Unauthorized error' do
          expect { subject.call }.to raise_error(ExceptionHandler::Unauthorized, Message.unauthorized)
        end
      end
    end

    context 'when missing token' do
      let(:header) { {} }

      it 'raises MissingToken error' do
        expect { subject.call }.to raise_error(ExceptionHandler::MissingToken, Message.missing_token)
      end
    end

    context 'when invalid token' do
      let(:header) { { 'Authorization' => 'Bearer invalid_token' } }

      it 'raises InvalidToken error' do
        expect { subject.call }.to raise_error(ExceptionHandler::InvalidToken, /Not enough or too many segments/)
      end
    end

    context 'when token is expired' do
      let(:token) { JsonWebToken.encode({ user_id: 1, exp: 1.hour.ago.to_i }) }

      it 'raises InvalidToken error' do
        expect { subject.call }.to raise_error(ExceptionHandler::InvalidToken, /Signature has expired/)
      end
    end
  end
end
