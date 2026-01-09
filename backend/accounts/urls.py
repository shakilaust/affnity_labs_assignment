from django.urls import path

from .views import login, logout, me, signup

urlpatterns = [
    path('signup', signup, name='auth-signup'),
    path('login', login, name='auth-login'),
    path('logout', logout, name='auth-logout'),
    path('me', me, name='auth-me'),
]
