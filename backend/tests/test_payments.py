import unittest
import asyncio
from unittest.mock import patch, MagicMock
from app.models.payment import PaymentProvider, PaymentStatus, PaymentTransaction
from app.services.payments.payment_gateway_manager import PaymentGatewayManager
from app.services.payments.konnect_service import KonnectPaymentService
from app.services.payments.flouci_service import FlouciPaymentService
from app.services.payments.paymee_service import PaymeePaymentService


class TestTunisianPaymentGateways(unittest.TestCase):
    def test_providers_list(self):
        providers = PaymentGatewayManager.get_available_providers()
        self.assertEqual(len(providers), 3)
        provider_ids = [p["id"] for p in providers]
        self.assertIn(PaymentProvider.KONNECT, provider_ids)
        self.assertIn(PaymentProvider.FLOUCI, provider_ids)
        self.assertIn(PaymentProvider.PAYMEE, provider_ids)

    def test_konnect_service_simulation_mode(self):
        async def run_test():
            user_mock = MagicMock()
            user_mock.first_name = "Ahmed"
            user_mock.last_name = "Ben Ali"
            user_mock.email = "ahmed@example.tn"
            tx_mock = MagicMock()
            tx_mock.id = "60c72b2f9b1d8b2bad000001"
            tx_mock.plan = "PREMIUM"
            tx_mock.amount_millimes = 25000

            pay_url, provider_id, is_sim = await KonnectPaymentService.initiate_payment(
                user=user_mock,
                transaction=tx_mock,
                frontend_url="http://localhost:5173",
                backend_url="http://localhost:8000"
            )
            self.assertTrue(is_sim)
            self.assertIn("provider=konnect", pay_url)
            self.assertTrue(provider_id.startswith("sim_konnect_"))

        asyncio.run(run_test())

    def test_flouci_service_simulation_mode(self):
        async def run_test():
            user_mock = MagicMock()
            tx_mock = MagicMock()
            tx_mock.id = "60c72b2f9b1d8b2bad000002"
            tx_mock.amount_millimes = 25000

            pay_url, provider_id, is_sim = await FlouciPaymentService.initiate_payment(
                user=user_mock,
                transaction=tx_mock,
                frontend_url="http://localhost:5173",
                backend_url="http://localhost:8000"
            )
            self.assertTrue(is_sim)
            self.assertIn("provider=flouci", pay_url)
            self.assertTrue(provider_id.startswith("sim_flouci_"))

        asyncio.run(run_test())

    def test_paymee_service_simulation_mode(self):
        async def run_test():
            user_mock = MagicMock()
            user_mock.first_name = "Sarra"
            user_mock.last_name = "Trabelsi"
            user_mock.email = "sarra@example.tn"
            user_mock.phone_number = "+21620123456"
            tx_mock = MagicMock()
            tx_mock.id = "60c72b2f9b1d8b2bad000003"
            tx_mock.plan = "PREMIUM"
            tx_mock.amount_tnd = 25.0

            pay_url, provider_id, is_sim = await PaymeePaymentService.initiate_payment(
                user=user_mock,
                transaction=tx_mock,
                frontend_url="http://localhost:5173",
                backend_url="http://localhost:8000"
            )
            self.assertTrue(is_sim)
            self.assertIn("provider=paymee", pay_url)
            self.assertTrue(provider_id.startswith("sim_paymee_"))

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
