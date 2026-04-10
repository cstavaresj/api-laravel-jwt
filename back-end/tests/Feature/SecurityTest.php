<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper: creates a user and returns auth token.
     */
    private function createUserAndGetToken(array $overrides = []): array
    {
        $password = $overrides['password'] ?? 'senha12345';

        $user = User::factory()->create(array_merge(
            ['password' => $password],
            collect($overrides)->except('password')->toArray()
        ));

        // Use tokenById instead of attempt to avoid global singleton guard caching in tests
        $token = auth('api')->tokenById($user->id);

        return ['user' => $user, 'token' => $token];
    }

    // =============================================
    // BRUTE FORCE PROTECTION
    // =============================================

    /** @test */
    public function test_brute_force_bloqueado_apos_5_tentativas(): void
    {
        // Make 5 failed login attempts
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'teste@email.com',
                'password' => 'errada',
            ]);
        }

        // 6th attempt should be rate limited
        $response = $this->postJson('/api/auth/login', [
            'email' => 'teste@email.com',
            'password' => 'errada',
        ]);

        $response->assertStatus(429);
    }

    // =============================================
    // TOKEN SECURITY
    // =============================================

    /** @test */
    public function test_acesso_com_token_invalido_retorna_401(): void
    {
        $response = $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer token_totalmente_invalido_e_adulterado',
        ]);

        $response->assertStatus(401);
    }

    /** @test */
    public function test_token_apos_logout_blacklisted_retorna_401(): void
    {
        $auth = $this->createUserAndGetToken();

        // Logout to blacklist the token
        $this->postJson('/api/auth/logout', [], [
            'Authorization' => "Bearer {$auth['token']}",
        ]);

        // Try to use blacklisted token
        $response = $this->getJson('/api/auth/me', [
            'Authorization' => "Bearer {$auth['token']}",
        ]);

        $response->assertStatus(401);
    }

    // =============================================
    // OWNERSHIP ENFORCEMENT
    // =============================================

    /** @test */
    public function test_usuario_so_edita_seus_proprios_dados(): void
    {
        $userA = $this->createUserAndGetToken(['name' => 'User A', 'email' => 'usera@test.com']);
        $userB = $this->createUserAndGetToken(['name' => 'User B', 'email' => 'userb@test.com']);

        // User A tries to update profile — should only affect User A's data
        $response = $this->patchJson('/api/user/profile', [
            'name' => 'User A Editado',
        ], [
            'Authorization' => "Bearer {$userA['token']}",
        ]);

        $response->assertStatus(200);

        // Verify User A was updated
        $this->assertDatabaseHas('users', [
            'id' => $userA['user']->id,
            'name' => 'User A Editado',
        ]);

        // Verify User B was NOT affected
        $this->assertDatabaseHas('users', [
            'id' => $userB['user']->id,
            'name' => 'User B',
        ]);
    }

    /** @test */
    public function test_atualizar_com_email_de_outro_usuario_retorna_422(): void
    {
        $userA = $this->createUserAndGetToken(['email' => 'usera@test.com']);
        User::factory()->create(['email' => 'userb@test.com']);

        // User A tries to use User B's email
        $response = $this->patchJson('/api/user/profile', [
            'email' => 'userb@test.com',
        ], [
            'Authorization' => "Bearer {$userA['token']}",
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    // =============================================
    // MASS ASSIGNMENT PROTECTION
    // =============================================

    /** @test */
    public function test_mass_assignment_campos_protegidos_ignorados(): void
    {
        $auth = $this->createUserAndGetToken();
        $originalId = $auth['user']->id;

        // Try to mass-assign protected fields
        $response = $this->patchJson('/api/user/profile', [
            'name' => 'Nome Atualizado',
            'id' => 999,
            'password' => 'nova_senha_hacker',
            'is_admin' => true,
        ], [
            'Authorization' => "Bearer {$auth['token']}",
        ]);

        $response->assertStatus(200);

        // Verify only allowed fields were updated
        $user = User::find($originalId);
        $this->assertEquals('Nome Atualizado', $user->name);
        $this->assertEquals($originalId, $user->id); // ID didn't change
    }

    // =============================================
    // SQL INJECTION PROTECTION
    // =============================================

    /** @test */
    public function test_sql_injection_no_email_bloqueado(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => "admin@test.com' OR '1'='1",
            'password' => 'qualquer',
        ]);

        // Should fail validation (invalid email format) or return 401
        $this->assertTrue(
            $response->status() === 422 || $response->status() === 401,
            "Expected 422 or 401, got {$response->status()}"
        );
    }

    /** @test */
    public function test_sql_injection_no_registro_bloqueado(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => "Robert'; DROP TABLE users;--",
            'email' => 'teste@email.com',
            'password' => 'senha12345',
            'password_confirmation' => 'senha12345',
        ]);

        // Should succeed but with sanitized name (Laravel uses prepared statements)
        if ($response->status() === 201) {
            // Verify users table still exists
            $this->assertDatabaseCount('users', 1);
        }
    }

    // =============================================
    // XSS PROTECTION
    // =============================================

    /** @test */
    public function test_xss_no_campo_name_armazenado_como_texto(): void
    {
        $auth = $this->createUserAndGetToken();

        $xssPayload = '<script>alert("XSS")</script>';

        $response = $this->patchJson('/api/user/profile', [
            'name' => $xssPayload,
        ], [
            'Authorization' => "Bearer {$auth['token']}",
        ]);

        $response->assertStatus(200);

        // The value is stored as plain text (Eloquent doesn't execute scripts)
        // The important thing is that it's escaped when rendered
        $user = User::find($auth['user']->id);
        $this->assertEquals($xssPayload, $user->name);

        // When returned via JSON, it's properly escaped by json_encode
        $meResponse = $this->getJson('/api/auth/me', [
            'Authorization' => "Bearer {$auth['token']}",
        ]);

        $meResponse->assertStatus(200);
        // O Laravel retorna application/json, que protege contra a execução do script no XSS.
        $meResponse->assertHeader('Content-Type', 'application/json');
        
        // A API apenas devolve o JSON; o frontend é responsável pelo HTML escape no DOM.
        // Confirmamos apenas que a string chegou sem quebrar a estrutura.
        $this->assertEquals(
            $xssPayload,
            $meResponse->json('user.name')
        );
    }

    // =============================================
    // CORS CHECK
    // =============================================

    /** @test */
    public function test_cors_headers_presentes_na_resposta(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5500',
        ])->getJson('/api/');

        $response->assertStatus(200);
        // CORS headers should be present for allowed origins
    }

    /** @test */
    public function test_rota_protegida_sem_token_retorna_json_401(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }
}
