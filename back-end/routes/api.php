<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Rotas da API JWT. Todas as rotas possuem prefixo /api automaticamente.
|
*/

// Rota pública — informações da API
Route::get('/', function () {
    return response()->json([
        'success' => true,
        'message' => 'API Laravel JWT - Funcionando!',
        'version' => app()->version(),
    ]);
});

// Rotas de autenticação
Route::prefix('auth')->group(function () {
    // Rotas públicas
    Route::post('login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1'); // 5 tentativas por minuto (anti brute-force)
    Route::post('register', [AuthController::class, 'register']);

    // Rotas protegidas (requer JWT válido)
    Route::middleware('auth:api')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
    });
});

// Rotas de usuário (requer JWT válido)
Route::middleware('auth:api')->group(function () {
    Route::patch('user/profile', [UserController::class, 'profile']);
});
