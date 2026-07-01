<?php
/**
 * Plugin Name: PSSL SSO Provider
 * Description: Lets external PSSL apps (like the food site) sign users in with their PSSL WordPress account via a minimal OAuth 2.0 authorization-code flow. Activate on the PSSL site of the network only.
 * Version:     1.0.0
 * Author:      PSSL
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PSSL_SSO_Provider {

	const OPTION    = 'pssl_sso_settings';
	const CODE_TTL  = 120; // seconds an authorization code stays valid
	const TOKEN_TTL = 300; // seconds an access token stays valid

	public static function boot() {
		$self = new self();
		register_activation_hook( __FILE__, array( $self, 'activate' ) );
		add_action( 'init', array( $self, 'maybe_handle_authorize' ) );
		add_action( 'rest_api_init', array( $self, 'register_rest_routes' ) );
		add_action( 'admin_menu', array( $self, 'add_settings_page' ) );
	}

	/* ---------------------------------------------------------------- setup */

	public function activate() {
		if ( ! get_option( self::OPTION ) ) {
			update_option(
				self::OPTION,
				array(
					'client_id'     => 'pssl-food-' . substr( bin2hex( random_bytes( 8 ) ), 0, 12 ),
					'client_secret' => bin2hex( random_bytes( 32 ) ),
					'redirect_uris' => array(),
				),
				false
			);
		}
	}

	private function settings() {
		$s = get_option( self::OPTION );
		if ( ! is_array( $s ) ) {
			$this->activate();
			$s = get_option( self::OPTION );
		}
		return $s;
	}

	/* ------------------------------------------------------ authorize (GET) */

	/**
	 * Handles https://site/?pssl_sso=authorize&client_id=..&redirect_uri=..&state=..
	 * If the visitor is not logged in they are sent through the normal WP login
	 * (i.e. whatever SSO plugin the site uses) and land back here afterwards.
	 */
	public function maybe_handle_authorize() {
		if ( ! isset( $_GET['pssl_sso'] ) || 'authorize' !== $_GET['pssl_sso'] ) {
			return;
		}

		$s            = $this->settings();
		$client_id    = isset( $_GET['client_id'] ) ? sanitize_text_field( wp_unslash( $_GET['client_id'] ) ) : '';
		$redirect_uri = isset( $_GET['redirect_uri'] ) ? esc_url_raw( wp_unslash( $_GET['redirect_uri'] ) ) : '';
		$state        = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : '';
		$resp_type    = isset( $_GET['response_type'] ) ? sanitize_text_field( wp_unslash( $_GET['response_type'] ) ) : 'code';

		if ( 'code' !== $resp_type ) {
			wp_die( 'PSSL SSO: unsupported response_type.' );
		}
		if ( empty( $client_id ) || ! hash_equals( $s['client_id'], $client_id ) ) {
			wp_die( 'PSSL SSO: unknown client.' );
		}
		if ( empty( $redirect_uri ) || ! in_array( $redirect_uri, (array) $s['redirect_uris'], true ) ) {
			wp_die( 'PSSL SSO: redirect_uri is not on the allowed list. Add it in Settings &rarr; PSSL SSO.' );
		}

		if ( ! is_user_logged_in() ) {
			auth_redirect(); // sends to wp-login (and through the site's SSO), then back to this URL
			exit;
		}

		$user = wp_get_current_user();
		if ( is_multisite() && ! is_user_member_of_blog( $user->ID ) && ! is_super_admin( $user->ID ) ) {
			wp_die( 'Sorry, your account is not a member of this site, so it cannot be used for PSSL apps.' );
		}

		$code = bin2hex( random_bytes( 32 ) );
		set_transient(
			'pssl_sso_code_' . hash( 'sha256', $code ),
			array(
				'user_id'      => $user->ID,
				'redirect_uri' => $redirect_uri,
			),
			self::CODE_TTL
		);

		$back = add_query_arg(
			array_filter(
				array(
					'code'  => $code,
					'state' => $state,
				)
			),
			$redirect_uri
		);
		wp_redirect( $back ); // phpcs:ignore WordPress.Security.SafeRedirect -- external, allow-listed above
		exit;
	}

	/* ------------------------------------------------------------ REST API */

	public function register_rest_routes() {
		register_rest_route(
			'pssl-sso/v1',
			'/token',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_token' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'pssl-sso/v1',
			'/userinfo',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_userinfo' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public function handle_token( WP_REST_Request $req ) {
		$s = $this->settings();

		if ( 'authorization_code' !== $req->get_param( 'grant_type' ) ) {
			return new WP_REST_Response( array( 'error' => 'unsupported_grant_type' ), 400 );
		}

		$client_id     = (string) $req->get_param( 'client_id' );
		$client_secret = (string) $req->get_param( 'client_secret' );
		if ( ! hash_equals( $s['client_id'], $client_id ) || ! hash_equals( $s['client_secret'], $client_secret ) ) {
			return new WP_REST_Response( array( 'error' => 'invalid_client' ), 401 );
		}

		$code = (string) $req->get_param( 'code' );
		$key  = 'pssl_sso_code_' . hash( 'sha256', $code );
		$data = $code ? get_transient( $key ) : false;
		if ( ! $data ) {
			return new WP_REST_Response( array( 'error' => 'invalid_grant' ), 400 );
		}
		delete_transient( $key ); // single use

		if ( (string) $req->get_param( 'redirect_uri' ) !== $data['redirect_uri'] ) {
			return new WP_REST_Response( array( 'error' => 'invalid_grant' ), 400 );
		}

		$token = bin2hex( random_bytes( 32 ) );
		set_transient(
			'pssl_sso_tok_' . hash( 'sha256', $token ),
			array( 'user_id' => $data['user_id'] ),
			self::TOKEN_TTL
		);

		return new WP_REST_Response(
			array(
				'access_token' => $token,
				'token_type'   => 'Bearer',
				'expires_in'   => self::TOKEN_TTL,
			),
			200
		);
	}

	public function handle_userinfo( WP_REST_Request $req ) {
		$token = '';
		$auth  = $req->get_header( 'authorization' );
		if ( ! $auth && isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) { // some Apache configs strip the header
			$auth = wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] );
		}
		if ( $auth && 0 === stripos( $auth, 'Bearer ' ) ) {
			$token = trim( substr( $auth, 7 ) );
		}
		if ( ! $token ) {
			$token = (string) $req->get_param( 'access_token' ); // fallback for servers that eat the header
		}
		if ( ! $token ) {
			return new WP_REST_Response( array( 'error' => 'invalid_token' ), 401 );
		}

		$data = get_transient( 'pssl_sso_tok_' . hash( 'sha256', $token ) );
		if ( ! $data ) {
			return new WP_REST_Response( array( 'error' => 'invalid_token' ), 401 );
		}

		$user = get_userdata( $data['user_id'] );
		if ( ! $user || ( is_multisite() && ! is_user_member_of_blog( $user->ID ) && ! is_super_admin( $user->ID ) ) ) {
			return new WP_REST_Response( array( 'error' => 'invalid_token' ), 401 );
		}

		return new WP_REST_Response(
			array(
				'sub'        => (int) $user->ID,
				'email'      => $user->user_email,
				'name'       => $user->display_name,
				'first_name' => $user->first_name,
				'last_name'  => $user->last_name,
				'username'   => $user->user_login,
				'roles'      => array_values( (array) $user->roles ),
			),
			200
		);
	}

	/* -------------------------------------------------------- settings page */

	public function add_settings_page() {
		add_options_page( 'PSSL SSO', 'PSSL SSO', 'manage_options', 'pssl-sso', array( $this, 'render_settings_page' ) );
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$s = $this->settings();

		if ( isset( $_POST['pssl_sso_save'] ) && check_admin_referer( 'pssl_sso_settings' ) ) {
			$uris = isset( $_POST['redirect_uris'] ) ? sanitize_textarea_field( wp_unslash( $_POST['redirect_uris'] ) ) : '';
			$s['redirect_uris'] = array_values( array_filter( array_map( 'trim', explode( "\n", $uris ) ) ) );
			if ( ! empty( $_POST['regenerate_secret'] ) ) {
				$s['client_secret'] = bin2hex( random_bytes( 32 ) );
			}
			update_option( self::OPTION, $s, false );
			echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
		}

		$authorize_url = home_url( '/?pssl_sso=authorize' );
		$token_url     = rest_url( 'pssl-sso/v1/token' );
		$userinfo_url  = rest_url( 'pssl-sso/v1/userinfo' );
		?>
		<div class="wrap">
			<h1>PSSL SSO Provider</h1>
			<p>External PSSL apps use these credentials to sign users in with their account on this site.</p>
			<table class="form-table" role="presentation">
				<tr><th>Client ID</th><td><code><?php echo esc_html( $s['client_id'] ); ?></code></td></tr>
				<tr><th>Client Secret</th><td><code><?php echo esc_html( $s['client_secret'] ); ?></code></td></tr>
				<tr><th>Authorize URL</th><td><code><?php echo esc_html( $authorize_url ); ?></code></td></tr>
				<tr><th>Token URL</th><td><code><?php echo esc_html( $token_url ); ?></code></td></tr>
				<tr><th>Userinfo URL</th><td><code><?php echo esc_html( $userinfo_url ); ?></code></td></tr>
			</table>
			<form method="post">
				<?php wp_nonce_field( 'pssl_sso_settings' ); ?>
				<h2>Allowed redirect URIs</h2>
				<p>One per line, exact match. For the food site this is <code>https://&lt;food-domain&gt;/auth/wp/callback</code></p>
				<textarea name="redirect_uris" rows="4" cols="70"><?php echo esc_textarea( implode( "\n", (array) $s['redirect_uris'] ) ); ?></textarea>
				<p><label><input type="checkbox" name="regenerate_secret" value="1"> Regenerate client secret (breaks existing apps until they are updated)</label></p>
				<p><button type="submit" name="pssl_sso_save" value="1" class="button button-primary">Save</button></p>
			</form>
		</div>
		<?php
	}
}

PSSL_SSO_Provider::boot();
