module Api
  class AuthController < ApplicationController
    def github
      redirect_to "/auth/github", allow_other_host: true
    end

    def callback
      auth = request.env["omniauth.auth"]
      user = User.find_or_create_from_github(
        id: auth.uid.to_i,
        login: auth.info.nickname,
        token: auth.credentials.token
      )
      session[:user_id] = user.id
      base = ENV["FRONTEND_URL"].presence
      redirect_to base ? "#{base.sub(%r{/$}, '')}/generate" : "/generate", allow_other_host: true
    end

    def me
      if current_user
        render json: { login: current_user.login, github_id: current_user.github_id }
      else
        render json: { error: "Not authenticated" }, status: :unauthorized
      end
    end

    def logout
      reset_session
      render json: { ok: true }
    end
  end
end
