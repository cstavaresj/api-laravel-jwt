<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    // =============================================
    // LOGIN TESTS
    // =============================================

    /** @test */
    public function test_login_com_credenciais_validas_retorna_token(): void
    {
        $user = User::factory()->create([
            'password' => 'senha12345',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'senha12345',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'access_token',
                'token_type',
                'expires_in',
            ])
            ->assertJson([
                'success' => true,
                'token_type' => 'bearer',
            ]);
    }

    /** @test */
    public function test_login_com_email_inexistente_retorna_401(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'naoexiste@email.com',
            'password' => 'qualquersenha',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    /** @test */
    public function test_login_com_senha_errada_retorna_401(): void
    {
        $user = User::factory()->create([
            'password' => 'senha_correta',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'senha_errada',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    /** @test */
    public function test_login_com_campos_vazios_retorna_422(): void
    {
        $response = $this->postJson('/api/auth/login', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    // =============================================
    // REGISTER TESTS
    // =============================================

    /** @test */
    public function test_registro_com_dados_validos_cria_usuario(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Teste User',
            'email' => 'teste@email.com',
            'password' => 'senha12345',
            'password_confirmation' => 'senha12345',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Usuário registrado com sucesso!',
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'teste@email.com',
            'name' => 'Teste User',
        ]);
    }

    /** @test */
    public function test_registro_com_email_duplicado_retorna_422(): void
    {
        User::factory()->create([
            'email' => 'existente@email.com',
        ]);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Outro User',
            'email' => 'existente@email.com',
            'password' => 'senha12345',
            'password_confirmation' => 'senha12345',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /** @test */
    public function test_registro_com_senha_curta_retorna_422(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Teste',
            'email' => 'teste@email.com',
            'password' => '123',
            'password_confirmation' => '123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    /** @test */
    public function test_registro_sem_confirmacao_de_senha_retorna_422(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Teste',
            'email' => 'teste@email.com',
            'password' => 'senha12345',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    // =============================================
    // ME TESTS
    // =============================================

    /** @test */
    public function test_me_retorna_dados_do_usuario_autenticado(): void
    {
        $user = User::factory()->create([
            'password' => 'senha12345',
        ]);

        $token = auth('api')->attempt([
            'email' => $user->email,
            'password' => 'senha12345',
        ]);

        $response = $this->getJson('/api/auth/me', [
            'Authorization' => "Bearer {$token}",
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
            ]);
    }

    /** @test */
    public function test_me_sem_token_retorna_401(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
    }

    // =============================================
    // LOGOUT TESTS
    // =============================================

    /** @test */
    public function test_logout_invalida_token(): void
    {
        $user = User::factory()->create([
            'password' => 'senha12345',
        ]);

        $token = auth('api')->attempt([
            'email' => $user->email,
            'password' => 'senha12345',
        ]);

        // Logout
        $response = $this->postJson('/api/auth/logout', [], [
            'Authorization' => "Bearer {$token}",
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logout realizado com sucesso!',
            ]);

        // Try to use the same token — should be blacklisted
        $response = $this->getJson('/api/auth/me', [
            'Authorization' => "Bearer {$token}",
        ]);

        $response->assertStatus(401);
    }

    // =============================================
    // REFRESH TESTS
    // =============================================

    /** @test */
    public function test_refresh_retorna_novo_token(): void
    {
        $user = User::factory()->create([
            'password' => 'senha12345',
        ]);

        $token = auth('api')->attempt([
            'email' => $user->email,
            'password' => 'senha12345',
        ]);

        $response = $this->postJson('/api/auth/refresh', [], [
            'Authorization' => "Bearer {$token}",
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'access_token',
                'token_type',
                'expires_in',
            ]);
    }

    /** @test */
    public function test_refresh_sem_token_retorna_401(): void
    {
        $response = $this->postJson('/api/auth/refresh');

        $response->assertStatus(401);
    }
}
